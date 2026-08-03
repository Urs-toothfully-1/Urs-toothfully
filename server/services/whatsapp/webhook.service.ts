import { createHmac, timingSafeEqual } from "crypto"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { whatsappWebhookRepository } from "@/server/repositories/whatsapp-webhook.repository"
import { decryptSecret } from "@/lib/whatsapp/crypto"
import type { Prisma } from "@prisma/client"

/**
 * Meta webhook handling: GET verification handshake + POST delivery events.
 * Every received payload is stored in WhatsAppWebhookLog for audit/debugging.
 */

interface MetaStatusEvent {
  id: string // meta message id (wamid.…)
  status: "sent" | "delivered" | "read" | "failed" | string
  timestamp: string
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>
}

export const webhookService = {
  /** GET handshake — Meta sends hub.mode/hub.verify_token/hub.challenge. */
  async handleVerification(mode: string | null, token: string | null, challenge: string | null): Promise<string | null> {
    if (mode !== "subscribe" || !token || !challenge) return null
    const settings = await whatsappSettingsRepository.get()
    if (!settings?.webhookVerifyToken) return null
    return token === settings.webhookVerifyToken ? challenge : null
  },

  /**
   * Validates X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app
   * secret). When no webhook secret is stored, the signature is not enforced.
   */
  async verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
    const settings = await whatsappSettingsRepository.get()
    // Fail closed. This endpoint is public (proxy PUBLIC_PATHS), so accepting
    // unsigned posts when no secret is configured let anyone rewrite message
    // statuses and flood the webhook log. Without a secret there is no genuine
    // Meta traffic to accept anyway.
    if (!settings?.webhookSecretEnc) return false

    if (!signatureHeader?.startsWith("sha256=")) return false
    try {
      const secret = decryptSecret(settings.webhookSecretEnc)
      const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
      const received = signatureHeader.slice("sha256=".length)
      if (expected.length !== received.length) return false
      return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"))
    } catch {
      return false
    }
  },

  /** Processes a webhook POST body: updates message statuses, logs everything. */
  async processEvent(payload: Record<string, unknown>): Promise<{ handled: number }> {
    let handled = 0
    let firstError: string | undefined
    let firstMetaId: string | undefined
    let eventType: string | undefined

    try {
      const entries = (payload.entry as Array<Record<string, unknown>> | undefined) ?? []
      for (const entry of entries) {
        const changes = (entry.changes as Array<Record<string, unknown>> | undefined) ?? []
        for (const change of changes) {
          const value = change.value as Record<string, unknown> | undefined
          if (!value) continue
          const statuses = (value.statuses as MetaStatusEvent[] | undefined) ?? []

          for (const s of statuses) {
            eventType = `status.${s.status}`
            firstMetaId = firstMetaId ?? s.id
            const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date()

            if (s.status === "sent") {
              await whatsappMessageRepository.updateStatusByMetaId(s.id, "SENT", at)
              handled++
            } else if (s.status === "delivered") {
              await whatsappMessageRepository.updateStatusByMetaId(s.id, "DELIVERED", at)
              handled++
            } else if (s.status === "read") {
              await whatsappMessageRepository.updateStatusByMetaId(s.id, "READ", at)
              handled++
            } else if (s.status === "failed") {
              const err = s.errors?.[0]
              const reason = err?.error_data?.details || err?.message || err?.title || "Delivery failed"
              await whatsappMessageRepository.updateStatusByMetaId(s.id, "FAILED", at, reason)
              handled++
            }
          }
        }
      }
    } catch (err) {
      firstError = err instanceof Error ? err.message : "Processing error"
    }

    await whatsappWebhookRepository.log({
      eventType,
      metaMessageId: firstMetaId,
      payload: payload as Prisma.InputJsonValue,
      processed: !firstError,
      error: firstError,
    })

    return { handled }
  },
}
