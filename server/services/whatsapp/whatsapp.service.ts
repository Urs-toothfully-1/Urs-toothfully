import { prisma } from "@/lib/prisma"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { whatsappTemplateRepository } from "@/server/repositories/whatsapp-template.repository"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"
import { WHATSAPP_TRIGGERS, WHATSAPP_CONSENT_VERSION, type WhatsAppTriggerKey } from "@/lib/whatsapp/templates"
import { encryptSecret, maskSecret } from "@/lib/whatsapp/crypto"
import { createAuditLog } from "@/lib/audit"

/**
 * Orchestrator for the WhatsApp module: consent, the consultation-payment
 * gate, automatic triggers, admin controls and dashboard analytics.
 *
 * TRIGGER POLICY (do not change without approval):
 * - NEVER send on patient registration or public intake completion.
 * - Messages only flow AFTER a consultation fee payment exists — that is the
 *   receptionist's confirmation that the patient is real and visited the clinic.
 */

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export const whatsappService = {
  // ─── Consent ────────────────────────────────────────────────

  async hasConsent(patientId: string): Promise<boolean> {
    const consent = await prisma.whatsAppConsent.findUnique({ where: { patientId } })
    return Boolean(consent?.consented && !consent.revokedAt)
  },

  async setConsent(patientId: string, consented: boolean, ip?: string): Promise<void> {
    await prisma.whatsAppConsent.upsert({
      where: { patientId },
      update: consented
        ? { consented: true, consentAt: new Date(), consentIp: ip, consentVersion: WHATSAPP_CONSENT_VERSION, revokedAt: null }
        : { consented: false, revokedAt: new Date() },
      create: {
        patientId,
        consented,
        consentAt: consented ? new Date() : null,
        consentIp: ip,
        consentVersion: WHATSAPP_CONSENT_VERSION,
      },
    })
  },

  // ─── Consultation gate ──────────────────────────────────────

  /** True once the patient has at least one consultation fee payment. */
  async hasPaidConsultation(patientId: string): Promise<boolean> {
    const count = await prisma.payment.count({
      where: { patientId, paymentType: "CONSULTATION", isDeleted: false },
    })
    return count > 0
  },

  // ─── Automatic triggers ─────────────────────────────────────

  /**
   * Enqueues a trigger-linked template for a patient. Silently skips when the
   * trigger has no enabled template, the patient lacks consent, or the
   * consultation gate is not yet passed. Never throws — automatic messaging
   * must not break clinical flows.
   */
  async sendTrigger(opts: {
    triggerKey: WhatsAppTriggerKey
    patientId: string
    variables: string[]
    branchId?: string
    createdById?: string
    skipConsultationGate?: boolean
  }): Promise<{ queued: boolean; reason?: string }> {
    try {
      const template = await whatsappTemplateRepository.findByTriggerKey(opts.triggerKey)
      if (!template || !template.isEnabled) return { queued: false, reason: "No enabled template for trigger" }

      if (!opts.skipConsultationGate && !(await this.hasPaidConsultation(opts.patientId))) {
        return { queued: false, reason: "Consultation fee not paid yet" }
      }

      const patient = await prisma.patient.findUnique({
        where: { id: opts.patientId },
        select: { mobile: true, isDeleted: true },
      })
      if (!patient || patient.isDeleted) return { queued: false, reason: "Patient not found" }

      await whatsappQueueService.enqueue({
        patientId: opts.patientId,
        branchId: opts.branchId,
        templateId: template.id,
        toPhone: patient.mobile,
        variables: opts.variables,
        triggerKey: opts.triggerKey,
        createdById: opts.createdById,
      })
      return { queued: true }
    } catch (err) {
      return { queued: false, reason: err instanceof Error ? err.message : "Enqueue failed" }
    }
  },

  /**
   * Called by payment.service after a payment is recorded. This is the ONLY
   * automatic entry point into WhatsApp sending.
   */
  async onPaymentCollected(paymentId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        patient: { select: { id: true, fullName: true, patientId: true } },
        receipt: { select: { receiptNo: true } },
        estimate: { select: { estimateNo: true } },
      },
    })
    if (!payment || payment.isDeleted) return

    const name = payment.patient.fullName
    const amount = formatAmount(Number(payment.amount))
    const receiptNo = payment.receipt?.receiptNo ?? "—"
    const date = formatDate(payment.paymentDate)
    const common = {
      patientId: payment.patient.id,
      branchId: payment.branchId,
      createdById: payment.collectedById,
    }

    if (payment.paymentType === "CONSULTATION") {
      // First consultation payment = the patient is verified → welcome them.
      const priorConsultations = await prisma.payment.count({
        where: { patientId: payment.patientId, paymentType: "CONSULTATION", isDeleted: false, id: { not: payment.id } },
      })
      if (priorConsultations === 0) {
        await this.sendTrigger({
          ...common,
          triggerKey: WHATSAPP_TRIGGERS.REGISTRATION_SUCCESSFUL,
          variables: [name, payment.patient.patientId],
        })
      }
      await this.sendTrigger({
        ...common,
        triggerKey: WHATSAPP_TRIGGERS.PAYMENT_RECEIPT,
        variables: [name, amount, receiptNo, date],
      })
      return
    }

    if (payment.paymentType === "ADVANCE") {
      await this.sendTrigger({
        ...common,
        triggerKey: WHATSAPP_TRIGGERS.ADVANCE_PAYMENT,
        variables: [name, amount, receiptNo, payment.estimate?.estimateNo ?? "—"],
      })
      return
    }

    if (payment.paymentType === "TREATMENT") {
      await this.sendTrigger({
        ...common,
        triggerKey: WHATSAPP_TRIGGERS.PAYMENT_RECEIPT,
        variables: [name, amount, receiptNo, date],
      })
    }
  },

  // ─── Manual sending (reception/admin) ───────────────────────

  async sendManual(opts: {
    patientId: string
    templateId: string
    variables: string[]
    branchId: string
    createdById: string
  }) {
    const patient = await prisma.patient.findUnique({
      where: { id: opts.patientId },
      select: { id: true, mobile: true, isDeleted: true },
    })
    if (!patient || patient.isDeleted) throw new Error("Patient not found")

    if (!(await this.hasPaidConsultation(opts.patientId))) {
      throw new Error("Messages can only be sent after the patient's consultation fee is collected.")
    }

    const message = await whatsappQueueService.enqueue({
      patientId: opts.patientId,
      branchId: opts.branchId,
      templateId: opts.templateId,
      toPhone: patient.mobile,
      variables: opts.variables,
      createdById: opts.createdById,
    })

    await createAuditLog({
      entityType: "WhatsAppMessage",
      entityId: message.id,
      action: "CREATE",
      changedById: opts.createdById,
      newValues: { templateName: message.templateName, toPhone: message.toPhone, manual: true },
      branchId: opts.branchId,
    })
    return message
  },

  // ─── Admin controls ─────────────────────────────────────────

  async setSendingEnabled(enabled: boolean, changedById: string) {
    await whatsappSettingsRepository.upsert({ sendingEnabled: enabled, updatedById: changedById })
    await createAuditLog({
      entityType: "WhatsAppSettings",
      entityId: "GLOBAL",
      action: "STATUS_CHANGE",
      changedById,
      newValues: { sendingEnabled: enabled },
    })
  },

  async setQueuePaused(paused: boolean, changedById: string) {
    await whatsappSettingsRepository.upsert({ queuePaused: paused, updatedById: changedById })
    await createAuditLog({
      entityType: "WhatsAppSettings",
      entityId: "GLOBAL",
      action: "STATUS_CHANGE",
      changedById,
      newValues: { queuePaused: paused },
    })
    if (!paused) void whatsappQueueService.processQueue().catch(() => null)
  },

  // ─── Settings ───────────────────────────────────────────────

  async saveSettings(
    input: {
      businessAccountId?: string
      phoneNumberId?: string
      accessToken?: string // plain — encrypted here; empty string = keep existing
      webhookVerifyToken?: string
      webhookSecret?: string // plain — encrypted here; empty string = keep existing
      graphApiVersion?: string
      businessDisplayName?: string
      defaultCountryCode?: string
      messageRateLimit?: number
      dailySendingLimit?: number
      maxRetryCount?: number
    },
    updatedById: string
  ) {
    const { accessToken, webhookSecret, ...rest } = input
    await whatsappSettingsRepository.upsert({
      ...rest,
      ...(accessToken ? { accessTokenEnc: encryptSecret(accessToken) } : {}),
      ...(webhookSecret ? { webhookSecretEnc: encryptSecret(webhookSecret) } : {}),
      updatedById,
    })
    await createAuditLog({
      entityType: "WhatsAppSettings",
      entityId: "GLOBAL",
      action: "UPDATE",
      changedById: updatedById,
      newValues: { ...rest, accessTokenChanged: Boolean(accessToken), webhookSecretChanged: Boolean(webhookSecret) },
    })
  },

  /** Settings shaped for the admin UI — secrets masked, never the raw token. */
  async getSettingsForAdmin() {
    const s = await whatsappSettingsRepository.get()
    if (!s) return null
    let tokenMask: string | null = null
    let secretMask: string | null = null
    try {
      const { decryptSecret } = await import("@/lib/whatsapp/crypto")
      if (s.accessTokenEnc) tokenMask = maskSecret(decryptSecret(s.accessTokenEnc))
      if (s.webhookSecretEnc) secretMask = maskSecret(decryptSecret(s.webhookSecretEnc))
    } catch {
      tokenMask = s.accessTokenEnc ? "•••••••• (stored)" : null
      secretMask = s.webhookSecretEnc ? "•••••••• (stored)" : null
    }
    return {
      businessAccountId: s.businessAccountId,
      phoneNumberId: s.phoneNumberId,
      accessTokenMask: tokenMask,
      webhookVerifyToken: s.webhookVerifyToken,
      webhookSecretMask: secretMask,
      graphApiVersion: s.graphApiVersion,
      businessDisplayName: s.businessDisplayName,
      defaultCountryCode: s.defaultCountryCode,
      apiStatus: s.apiStatus,
      phoneNumberStatus: s.phoneNumberStatus,
      businessVerificationStatus: s.businessVerificationStatus,
      lastSyncAt: s.lastSyncAt,
      sendingEnabled: s.sendingEnabled,
      queuePaused: s.queuePaused,
      messageRateLimit: s.messageRateLimit,
      dailySendingLimit: s.dailySendingLimit,
      maxRetryCount: s.maxRetryCount,
    }
  },

  // ─── Dashboard ──────────────────────────────────────────────

  async getOverview() {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const settings = await whatsappSettingsRepository.get()

    const [todayByStatus, weekByStatus, monthByStatus, queued, avgDelivery, topTemplates, topFailed, byBranch, byCreator, categoryToday] =
      await Promise.all([
        whatsappMessageRepository.statsBetween(todayStart, now),
        whatsappMessageRepository.statsBetween(weekStart, now),
        whatsappMessageRepository.statsBetween(monthStart, now),
        whatsappMessageRepository.countQueued(),
        whatsappMessageRepository.avgDeliverySeconds(weekStart, now),
        whatsappMessageRepository.topTemplates(monthStart, now, false),
        whatsappMessageRepository.topTemplates(monthStart, now, true),
        whatsappMessageRepository.countByBranch(monthStart, now),
        whatsappMessageRepository.countByCreator(monthStart, now),
        prisma.whatsAppMessage.groupBy({
          by: ["templateId"],
          where: { createdAt: { gte: todayStart } },
          _count: { _all: true },
        }),
      ])

    const sum = (m: Record<string, number>, keys: string[]) => keys.reduce((s, k) => s + (m[k] ?? 0), 0)
    const delivered = (m: Record<string, number>) => sum(m, ["SENT", "DELIVERED", "READ"])
    const successPct = (m: Record<string, number>) => {
      const done = delivered(m) + (m.FAILED ?? 0)
      return done === 0 ? null : Math.round((delivered(m) / done) * 100)
    }

    // Utility vs marketing split for today
    const templateIds = categoryToday.map((c) => c.templateId).filter((id): id is string => Boolean(id))
    const templates = templateIds.length
      ? await prisma.whatsAppTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, category: true } })
      : []
    const categoryOf = new Map(templates.map((t) => [t.id, t.category]))
    let utilityToday = 0
    let marketingToday = 0
    for (const c of categoryToday) {
      const cat = c.templateId ? categoryOf.get(c.templateId) : undefined
      if (cat === "MARKETING") marketingToday += c._count._all
      else utilityToday += c._count._all
    }

    // Resolve branch/creator names
    const branchIds = byBranch.map((b) => b.branchId).filter((id): id is string => Boolean(id))
    const creatorIds = byCreator.map((c) => c.createdById).filter((id): id is string => Boolean(id))
    const [branches, creators] = await Promise.all([
      branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
      creatorIds.length ? prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } }) : [],
    ])
    const branchName = new Map(branches.map((b) => [b.id, b.name]))
    const creatorName = new Map(creators.map((c) => [c.id, c.name]))

    return {
      configured: Boolean(settings?.businessAccountId && settings.phoneNumberId && settings.accessTokenEnc),
      apiStatus: settings?.apiStatus ?? "NOT_CONFIGURED",
      phoneNumberStatus: settings?.phoneNumberStatus ?? null,
      businessVerificationStatus: settings?.businessVerificationStatus ?? null,
      lastSyncAt: settings?.lastSyncAt ?? null,
      sendingEnabled: settings?.sendingEnabled ?? true,
      queuePaused: settings?.queuePaused ?? false,
      messageRateLimit: settings?.messageRateLimit ?? 20,
      dailySendingLimit: settings?.dailySendingLimit ?? 1000,
      today: {
        total: sum(todayByStatus, Object.keys(todayByStatus)),
        utility: utilityToday,
        marketing: marketingToday,
        failed: todayByStatus.FAILED ?? 0,
        pending: sum(todayByStatus, ["PENDING", "PROCESSING", "RETRY"]),
        successPct: successPct(todayByStatus),
      },
      week: { total: sum(weekByStatus, Object.keys(weekByStatus)), successPct: successPct(weekByStatus) },
      month: { total: sum(monthByStatus, Object.keys(monthByStatus)), successPct: successPct(monthByStatus) },
      queueSize: queued,
      avgDeliverySeconds: avgDelivery,
      topTemplates,
      topFailedTemplates: topFailed,
      byBranch: byBranch.map((b) => ({ name: b.branchId ? branchName.get(b.branchId) ?? "—" : "—", count: b._count._all })),
      byUser: byCreator.map((c) => ({ name: c.createdById ? creatorName.get(c.createdById) ?? "—" : "System", count: c._count._all })),
    }
  },
}
