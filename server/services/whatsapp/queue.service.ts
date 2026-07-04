import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { validateMobile } from "@/lib/whatsapp/phone"
import { renderTemplateBody } from "@/lib/whatsapp/templates"
import { whatsappTemplateRepository } from "@/server/repositories/whatsapp-template.repository"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"

/**
 * WhatsApp message queue. Messages are NEVER sent inline — they are enqueued
 * as PENDING rows and drained by processQueue(), which respects the admin
 * controls (emergency stop, pause, rate limit, daily limit) and retries
 * transient failures with exponential backoff.
 */

export interface EnqueueInput {
  patientId?: string
  branchId?: string
  templateId: string
  toPhone: string // raw patient mobile — normalized here
  variables: string[]
  triggerKey?: string
  createdById?: string
  scheduledFor?: Date
}

// Prevents overlapping queue drains inside one server process. Cross-process
// safety comes from the atomic claim in the repository.
let draining = false

const RETRY_BACKOFF_MINUTES = [1, 5, 30, 120]

export const whatsappQueueService = {
  /**
   * Validates and enqueues a message. Throws with a human-readable reason when
   * the message must not be sent (no consent, sending disabled, bad phone…).
   */
  async enqueue(input: EnqueueInput) {
    const settings = await whatsappSettingsRepository.get()
    if (settings && !settings.sendingEnabled) {
      throw new Error("WhatsApp sending is disabled by the administrator (emergency stop).")
    }

    const template = await whatsappTemplateRepository.findById(input.templateId)
    if (!template) throw new Error("Template not found")
    if (!template.isEnabled) throw new Error(`Template "${template.displayName}" is disabled.`)

    // Consent — never message a patient who has not opted in
    if (input.patientId) {
      const consent = await prisma.whatsAppConsent.findUnique({ where: { patientId: input.patientId } })
      if (!consent?.consented || consent.revokedAt) {
        throw new Error("Patient has not consented to WhatsApp updates.")
      }
    }

    const phone = validateMobile(input.toPhone, settings?.defaultCountryCode ?? "91")
    if (!phone.valid || !phone.normalized) {
      throw new Error(phone.error ?? "Invalid phone number")
    }

    const message = await whatsappMessageRepository.create({
      patientId: input.patientId,
      branchId: input.branchId,
      templateId: template.id,
      templateName: template.name,
      toPhone: phone.normalized,
      variables: input.variables,
      triggerKey: input.triggerKey,
      createdById: input.createdById,
      maxAttempts: settings?.maxRetryCount ?? 3,
      scheduledFor: input.scheduledFor ?? new Date(),
      status: "PENDING",
    })

    // Kick the drain without blocking the caller
    void whatsappQueueService.processQueue().catch(() => null)

    return message
  },

  /**
   * Drains due messages. Safe to call from anywhere (after enqueue, from the
   * /api/whatsapp/queue/process endpoint, or an external cron).
   */
  async processQueue(): Promise<{ processed: number; sent: number; failed: number }> {
    if (draining) return { processed: 0, sent: 0, failed: 0 }
    draining = true

    let processed = 0
    let sent = 0
    let failed = 0

    try {
      const settings = await whatsappSettingsRepository.get()
      if (!settings || !settings.sendingEnabled || settings.queuePaused) {
        return { processed, sent, failed }
      }
      if (!(await metaService.isConfigured())) return { processed, sent, failed }

      const perMinute = Math.max(1, settings.messageRateLimit)
      const gapMs = Math.ceil(60000 / perMinute)
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)

      // Drain at most one rate-limit window per invocation
      for (let i = 0; i < perMinute; i++) {
        const sentToday = await whatsappMessageRepository.countSentSince(dayStart)
        if (sentToday >= settings.dailySendingLimit) break

        const message = await whatsappMessageRepository.claimNextDue()
        if (!message) break
        processed++

        // Re-check controls between messages so Emergency Stop takes effect immediately
        const fresh = await whatsappSettingsRepository.get()
        if (!fresh?.sendingEnabled || fresh.queuePaused) {
          await whatsappMessageRepository.markFailed(message.id, "Sending paused by administrator", true, new Date(Date.now() + 60000))
          break
        }

        const result = await metaService.sendTemplateMessage({
          to: message.toPhone,
          templateName: message.templateName,
          language: message.template?.language ?? "en",
          bodyValues: (message.variables as string[] | null) ?? [],
        })

        if (result.success && result.metaMessageId) {
          await whatsappMessageRepository.markSent(message.id, result.metaMessageId)
          sent++
        } else {
          const willRetry = !result.permanent && message.attemptCount < message.maxAttempts
          const backoffMin = RETRY_BACKOFF_MINUTES[Math.min(message.attemptCount - 1, RETRY_BACKOFF_MINUTES.length - 1)]
          await whatsappMessageRepository.markFailed(
            message.id,
            result.error ?? "Send failed",
            willRetry,
            new Date(Date.now() + backoffMin * 60000)
          )
          failed++
        }

        if (i < perMinute - 1) await new Promise((r) => setTimeout(r, gapMs))
      }
    } finally {
      draining = false
    }

    return { processed, sent, failed }
  },

  async retryMessage(id: string, changedById: string) {
    const res = await whatsappMessageRepository.requeue(id)
    if (res.count === 0) throw new Error("Message is not in a retryable state.")
    await createAuditLog({
      entityType: "WhatsAppMessage",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      newValues: { status: "PENDING", reason: "manual retry" },
    })
    void whatsappQueueService.processQueue().catch(() => null)
  },

  async retryAllFailed(changedById: string) {
    const res = await whatsappMessageRepository.requeueAllFailed()
    if (res.count > 0) {
      await createAuditLog({
        entityType: "WhatsAppMessage",
        entityId: "BULK",
        action: "STATUS_CHANGE",
        changedById,
        newValues: { requeued: res.count },
      })
      void whatsappQueueService.processQueue().catch(() => null)
    }
    return res.count
  },

  async cancelMessage(id: string, changedById: string) {
    const res = await whatsappMessageRepository.cancel(id)
    if (res.count === 0) throw new Error("Only queued messages can be cancelled.")
    await createAuditLog({
      entityType: "WhatsAppMessage",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      newValues: { status: "CANCELLED" },
    })
  },

  /** Renders the final message text (for previews and logs). */
  async previewMessage(templateId: string, variables: string[]): Promise<string> {
    const template = await whatsappTemplateRepository.findById(templateId)
    if (!template) throw new Error("Template not found")
    return renderTemplateBody(template.body, variables)
  },
}
