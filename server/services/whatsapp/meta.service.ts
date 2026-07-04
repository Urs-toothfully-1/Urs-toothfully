import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { decryptSecret } from "@/lib/whatsapp/crypto"
import type { WhatsAppTemplate } from "@prisma/client"

/**
 * Thin Meta WhatsApp Cloud API (Graph API) client.
 * All requests are server-side; the access token never leaves this module.
 */

const GRAPH_BASE = "https://graph.facebook.com"

export interface MetaConfig {
  businessAccountId: string
  phoneNumberId: string
  accessToken: string
  version: string
}

export interface MetaSendResult {
  success: boolean
  metaMessageId?: string
  error?: string
  /** true when the failure is permanent (bad number, template rejected) — do not retry */
  permanent?: boolean
}

export interface MetaConnectionStatus {
  ok: boolean
  apiStatus: string
  phoneNumberStatus?: string
  businessVerificationStatus?: string
  displayPhoneNumber?: string
  verifiedName?: string
  qualityRating?: string
  error?: string
}

async function loadConfig(): Promise<MetaConfig> {
  const settings = await whatsappSettingsRepository.get()
  if (!settings?.businessAccountId || !settings.phoneNumberId || !settings.accessTokenEnc) {
    throw new Error("WhatsApp API is not configured. Ask an administrator to complete Meta API Settings.")
  }
  return {
    businessAccountId: settings.businessAccountId,
    phoneNumberId: settings.phoneNumberId,
    accessToken: decryptSecret(settings.accessTokenEnc),
    version: settings.graphApiVersion || "v21.0",
  }
}

async function graphFetch(
  config: MetaConfig,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${GRAPH_BASE}/${config.version}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

function graphErrorMessage(data: Record<string, unknown>): string {
  const err = data.error as { message?: string; code?: number; error_data?: { details?: string } } | undefined
  return err?.error_data?.details || err?.message || "Unknown Graph API error"
}

// Graph error codes that will never succeed on retry
const PERMANENT_ERROR_CODES = new Set([100, 131026, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 133010])

export const metaService = {
  loadConfig,

  async isConfigured(): Promise<boolean> {
    const settings = await whatsappSettingsRepository.get()
    return Boolean(settings?.businessAccountId && settings.phoneNumberId && settings.accessTokenEnc)
  },

  /**
   * Sends an approved template message.
   * @param to E.164 digits without "+", e.g. "919876543210"
   */
  async sendTemplateMessage(opts: {
    to: string
    templateName: string
    language: string
    bodyValues: string[]
  }): Promise<MetaSendResult> {
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Not configured", permanent: false }
    }

    const components =
      opts.bodyValues.length > 0
        ? [{ type: "body", parameters: opts.bodyValues.map((text) => ({ type: "text", text })) }]
        : undefined

    try {
      const { ok, data } = await graphFetch(config, `${config.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: opts.to,
          type: "template",
          template: {
            name: opts.templateName,
            language: { code: opts.language },
            ...(components && { components }),
          },
        }),
      })

      if (!ok) {
        const errObj = data.error as { code?: number } | undefined
        return {
          success: false,
          error: graphErrorMessage(data),
          permanent: errObj?.code !== undefined && PERMANENT_ERROR_CODES.has(errObj.code),
        }
      }

      const messages = data.messages as Array<{ id?: string }> | undefined
      return { success: true, metaMessageId: messages?.[0]?.id }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error", permanent: false }
    }
  },

  /** Verifies credentials and caches connection status on the settings row. */
  async testConnection(updatedById: string): Promise<MetaConnectionStatus> {
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return { ok: false, apiStatus: "NOT_CONFIGURED", error: err instanceof Error ? err.message : "Not configured" }
    }

    try {
      const [phoneRes, wabaRes] = await Promise.all([
        graphFetch(config, `${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`),
        graphFetch(config, `${config.businessAccountId}?fields=name,account_review_status`),
      ])

      if (!phoneRes.ok) {
        const result: MetaConnectionStatus = { ok: false, apiStatus: "ERROR", error: graphErrorMessage(phoneRes.data) }
        await whatsappSettingsRepository.patch({ apiStatus: "ERROR", updatedById })
        return result
      }

      const phoneStatus = String(phoneRes.data.code_verification_status ?? "CONNECTED")
      const bizStatus = wabaRes.ok ? String(wabaRes.data.account_review_status ?? "UNKNOWN") : "UNKNOWN"

      await whatsappSettingsRepository.patch({
        apiStatus: "CONNECTED",
        phoneNumberStatus: phoneStatus,
        businessVerificationStatus: bizStatus,
        lastSyncAt: new Date(),
        updatedById,
      })

      return {
        ok: true,
        apiStatus: "CONNECTED",
        phoneNumberStatus: phoneStatus,
        businessVerificationStatus: bizStatus,
        displayPhoneNumber: phoneRes.data.display_phone_number as string | undefined,
        verifiedName: phoneRes.data.verified_name as string | undefined,
        qualityRating: phoneRes.data.quality_rating as string | undefined,
      }
    } catch (err) {
      await whatsappSettingsRepository.patch({ apiStatus: "ERROR", updatedById }).catch(() => null)
      return { ok: false, apiStatus: "ERROR", error: err instanceof Error ? err.message : "Network error" }
    }
  },

  /** Fetches all message templates registered on the WABA. */
  async fetchTemplatesFromMeta(): Promise<Array<{
    id: string
    name: string
    category: string
    language: string
    status: string
    components: Array<Record<string, unknown>>
  }>> {
    const config = await loadConfig()
    const templates: Array<{ id: string; name: string; category: string; language: string; status: string; components: Array<Record<string, unknown>> }> = []
    let path = `${config.businessAccountId}/message_templates?limit=100`

    // paginate defensively (max 10 pages)
    for (let i = 0; i < 10 && path; i++) {
      const { ok, data } = await graphFetch(config, path)
      if (!ok) throw new Error(graphErrorMessage(data))
      templates.push(...((data.data as typeof templates) ?? []))
      const next = (data.paging as { next?: string } | undefined)?.next
      path = next ? next.replace(`${GRAPH_BASE}/${config.version}/`, "") : ""
    }
    return templates
  },

  /** Submits a local template to Meta for approval. Returns the Meta template id. */
  async createTemplateOnMeta(template: WhatsAppTemplate): Promise<string> {
    const config = await loadConfig()

    const components: Array<Record<string, unknown>> = []
    if (template.headerType === "TEXT" && template.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: template.headerText })
    }
    const bodyComponent: Record<string, unknown> = { type: "BODY", text: template.body }
    const variables = (template.variables as string[] | null) ?? []
    if (variables.length > 0) {
      bodyComponent.example = { body_text: [variables.map((v, i) => v || `Sample ${i + 1}`)] }
    }
    components.push(bodyComponent)
    if (template.footerText) components.push({ type: "FOOTER", text: template.footerText })
    const buttons = template.buttons as Array<{ type: string; text: string; url?: string }> | null
    if (buttons?.length) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((b) => ({ type: b.type, text: b.text, ...(b.url && { url: b.url }) })),
      })
    }

    const { ok, data } = await graphFetch(config, `${config.businessAccountId}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: template.language,
        components,
      }),
    })
    if (!ok) throw new Error(graphErrorMessage(data))
    return String(data.id)
  },

  /** Checks token validity and reports expiry details where available. */
  async checkTokenStatus(): Promise<{ valid: boolean; error?: string }> {
    try {
      const config = await loadConfig()
      const { ok, data } = await graphFetch(config, `${config.phoneNumberId}?fields=id`)
      return ok ? { valid: true } : { valid: false, error: graphErrorMessage(data) }
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Not configured" }
    }
  },
}
