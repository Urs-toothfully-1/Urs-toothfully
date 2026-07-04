"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"
import { templateService, templateSchema } from "@/server/services/whatsapp/template.service"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { z } from "zod"

export type WhatsAppActionState = {
  success?: boolean
  error?: string
  message?: string
}

// ─── Settings (ADMIN only — receptionists must never touch credentials) ───

const settingsSchema = z.object({
  businessAccountId: z.string().max(50).optional(),
  phoneNumberId: z.string().max(50).optional(),
  accessToken: z.string().optional(),
  webhookVerifyToken: z.string().max(120).optional(),
  webhookSecret: z.string().optional(),
  graphApiVersion: z.string().max(10).optional(),
  businessDisplayName: z.string().max(120).optional(),
  defaultCountryCode: z.string().max(5).optional(),
  messageRateLimit: z.coerce.number().int().min(1).max(600).optional(),
  dailySendingLimit: z.coerce.number().int().min(1).max(100000).optional(),
  maxRetryCount: z.coerce.number().int().min(0).max(10).optional(),
})

export async function saveWhatsAppSettingsAction(input: z.infer<typeof settingsSchema>): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" }

  try {
    await whatsappService.saveSettings(parsed.data, session.userId)
    revalidatePath("/whatsapp/settings")
    return { success: true, message: "Settings saved" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save settings" }
  }
}

export async function testWhatsAppConnectionAction(): Promise<WhatsAppActionState & {
  status?: Awaited<ReturnType<typeof metaService.testConnection>>
}> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const status = await metaService.testConnection(session.userId)
  revalidatePath("/whatsapp/settings")
  return status.ok
    ? { success: true, message: `Connected — ${status.verifiedName ?? ""} ${status.displayPhoneNumber ?? ""}`.trim(), status }
    : { error: status.error ?? "Connection failed", status }
}

export async function refreshWhatsAppTokenStatusAction(): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const result = await metaService.checkTokenStatus()
  return result.valid
    ? { success: true, message: "Access token is valid." }
    : { error: `Access token problem: ${result.error}. Generate a new token in Meta Business Manager and save it here.` }
}

export async function setWhatsAppSendingEnabledAction(enabled: boolean): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappService.setSendingEnabled(enabled, session.userId)
    revalidatePath("/whatsapp")
    return { success: true, message: enabled ? "Sending enabled" : "EMERGENCY STOP — sending disabled" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed" }
  }
}

export async function setWhatsAppQueuePausedAction(paused: boolean): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappService.setQueuePaused(paused, session.userId)
    revalidatePath("/whatsapp")
    return { success: true, message: paused ? "Queue paused" : "Queue resumed" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed" }
  }
}

// ─── Templates (ADMIN only) ───────────────────────────────────

export async function createWhatsAppTemplateAction(input: z.infer<typeof templateSchema>): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = templateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid template" }

  try {
    await templateService.create(parsed.data, session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: "Template created" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create template" }
  }
}

export async function updateWhatsAppTemplateAction(
  id: string,
  input: Partial<z.infer<typeof templateSchema>>
): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = templateSchema.partial().safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid template" }

  try {
    await templateService.update(id, parsed.data, session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: "Template updated" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update template" }
  }
}

export async function setWhatsAppTemplateEnabledAction(id: string, isEnabled: boolean): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await templateService.setEnabled(id, isEnabled, session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: isEnabled ? "Template enabled" : "Template disabled" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed" }
  }
}

export async function deleteWhatsAppTemplateAction(id: string): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await templateService.delete(id, session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: "Template deleted" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete template" }
  }
}

export async function syncTemplatesFromMetaAction(): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    const result = await templateService.syncFromMeta(session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: `Synced ${result.total} template(s) from Meta — ${result.updated} updated locally` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed" }
  }
}

export async function syncTemplateToMetaAction(id: string): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await templateService.syncToMeta(id, session.userId)
    revalidatePath("/whatsapp/templates")
    return { success: true, message: "Template submitted to Meta for approval" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit template" }
  }
}

// ─── Sending & queue (ADMIN + RECEPTIONIST) ──────────────────

const sendSchema = z.object({
  patientId: z.string().uuid(),
  templateId: z.string().uuid(),
  variables: z.array(z.string().max(500)).max(10),
})

export async function sendWhatsAppMessageAction(input: z.infer<typeof sendSchema>): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message" }

  try {
    await whatsappService.sendManual({
      ...parsed.data,
      branchId: session.branchId,
      createdById: session.userId,
    })
    revalidatePath("/whatsapp/queue")
    return { success: true, message: "Message queued for sending" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to queue message" }
  }
}

export async function retryWhatsAppMessageAction(id: string): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappQueueService.retryMessage(id, session.userId)
    revalidatePath("/whatsapp/queue")
    return { success: true, message: "Message requeued" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Retry failed" }
  }
}

export async function retryAllFailedWhatsAppMessagesAction(): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    const count = await whatsappQueueService.retryAllFailed(session.userId)
    revalidatePath("/whatsapp/queue")
    return { success: true, message: `${count} failed message(s) requeued` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Retry failed" }
  }
}

export async function cancelWhatsAppMessageAction(id: string): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappQueueService.cancelMessage(id, session.userId)
    revalidatePath("/whatsapp/queue")
    return { success: true, message: "Message cancelled" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cancel failed" }
  }
}

export async function processWhatsAppQueueAction(): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    const result = await whatsappQueueService.processQueue()
    revalidatePath("/whatsapp/queue")
    return { success: true, message: `Processed ${result.processed} — sent ${result.sent}, failed ${result.failed}` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Processing failed" }
  }
}

// ─── Consent (ADMIN + RECEPTIONIST) ──────────────────────────

export async function setWhatsAppConsentAction(patientId: string, consented: boolean): Promise<WhatsAppActionState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappService.setConsent(patientId, consented)
    revalidatePath(`/patients/${patientId}`)
    return { success: true, message: consented ? "WhatsApp consent recorded" : "WhatsApp consent revoked" }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update consent" }
  }
}
