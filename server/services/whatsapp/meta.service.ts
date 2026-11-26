import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { decryptSecret } from "@/lib/whatsapp/crypto"
import type { WhatsAppTemplate } from "@prisma/client"
import type { OutMsg } from "@/lib/whatsapp/chat-flow"

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
    throw new Error(
      "WhatsApp API is not configured. Ask an administrator to complete Meta API Settings."
    )
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
  const err = data.error as
    | { message?: string; code?: number; error_data?: { details?: string } }
    | undefined
  return err?.error_data?.details || err?.message || "Unknown Graph API error"
}

function sendFailure(data: Record<string, unknown>): MetaSendResult {
  const errObj = data.error as { code?: number } | undefined
  return {
    success: false,
    error: graphErrorMessage(data),
    permanent: errObj?.code !== undefined && PERMANENT_ERROR_CODES.has(errObj.code),
  }
}

/** One-page PDF Meta shows reviewers as the example for a DOCUMENT-header template. */
function samplePdf(): Buffer {
  const stream = "BT /F1 18 Tf 72 760 Td (Ur's Toothfully - sample document) Tj ET"
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}

/**
 * Uploads an example file with Meta's Resumable Upload API and returns the
 * handle that template creation needs for a media header.
 */
async function uploadExampleHandle(config: MetaConfig, file: Buffer, fileName: string): Promise<string> {
  const dbg = await graphFetch(config, `debug_token?input_token=${config.accessToken}`)
  const appId = (dbg.data.data as { app_id?: string } | undefined)?.app_id
  if (!appId) throw new Error("Could not read the Meta app id from the access token.")
  const start = await graphFetch(
    config,
    `${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${file.length}&file_type=application/pdf`,
    { method: "POST" }
  )
  if (!start.ok) throw new Error(graphErrorMessage(start.data))
  const res = await fetch(`${GRAPH_BASE}/${config.version}/${String(start.data.id)}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${config.accessToken}`, file_offset: "0" },
    body: new Uint8Array(file),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || !data.h) throw new Error(graphErrorMessage(data))
  return String(data.h)
}

// Graph error codes that will never succeed on retry
const PERMANENT_ERROR_CODES = new Set([
  100, 131026, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 133010,
])

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
    /** Media id + file name for a DOCUMENT-header template. */
    headerDocument?: { id: string; filename: string }
  }): Promise<MetaSendResult> {
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Not configured",
        permanent: false,
      }
    }

    const parts: Array<Record<string, unknown>> = []
    if (opts.headerDocument)
      parts.push({
        type: "header",
        parameters: [{ type: "document", document: opts.headerDocument }],
      })
    if (opts.bodyValues.length > 0)
      parts.push({ type: "body", parameters: opts.bodyValues.map((text) => ({ type: "text", text })) })
    const components = parts.length > 0 ? parts : undefined

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
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
        permanent: false,
      }
    }
  },

  /**
   * Sends a free-form text (session) message — used by the auto-reply bot to
   * answer a patient WITHIN the 24-hour customer service window (free of charge).
   * Outside that window Meta rejects it (#131047), which we treat as permanent.
   * @param to E.164 digits without "+", e.g. "919876543210"
   */
  async sendTextMessage(to: string, body: string): Promise<MetaSendResult> {
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Not configured",
        permanent: false,
      }
    }
    try {
      const { ok, data } = await graphFetch(config, `${config.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
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
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
        permanent: false,
      }
    }
  },

  /** Uploads a PDF to Meta for sending; returns the media id (Meta keeps it 30 days). */
  async uploadMedia(file: Buffer, fileName: string): Promise<string> {
    const config = await loadConfig()
    const form = new FormData()
    form.append("messaging_product", "whatsapp")
    form.append("type", "application/pdf")
    form.append("file", new Blob([new Uint8Array(file)], { type: "application/pdf" }), fileName)
    const res = await fetch(`${GRAPH_BASE}/${config.version}/${config.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || !data.id) throw new Error(graphErrorMessage(data))
    return String(data.id)
  },

  /**
   * Sends an uploaded PDF as a session message with a caption — free, but only
   * inside the 24-hour window after the patient last messaged the clinic.
   */
  async sendDocumentMessage(
    to: string,
    doc: { id: string; filename: string; caption: string }
  ): Promise<MetaSendResult> {
    try {
      const config = await loadConfig()
      const { ok, data } = await graphFetch(config, `${config.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "document",
          document: { id: doc.id, filename: doc.filename, caption: doc.caption.slice(0, 1024) },
        }),
      })
      if (!ok) return sendFailure(data)
      const messages = data.messages as Array<{ id?: string }> | undefined
      return { success: true, metaMessageId: messages?.[0]?.id }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" }
    }
  },

  /**
   * Sends an interactive session message (reply buttons, list menu or link
   * button) — free within the 24h customer-service window. Titles are clipped to
   * Meta's limits so a long label can never make the whole send fail.
   */
  async sendInteractiveMessage(to: string, msg: OutMsg): Promise<MetaSendResult> {
    if (!msg.ui)
      return metaService.sendTextMessage(to, msg.footer ? `${msg.text}\n\n${msg.footer}` : msg.text)
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Not configured",
        permanent: false,
      }
    }
    const body = { text: msg.text.slice(0, 1024) }
    const footer = msg.footer ? { footer: { text: msg.footer.slice(0, 60) } } : {}
    const ui = msg.ui
    const interactive =
      ui.kind === "buttons"
        ? {
            type: "button",
            body,
            ...footer,
            action: {
              buttons: ui.items
                .slice(0, 3)
                .map((i) => ({ type: "reply", reply: { id: i.id, title: i.title.slice(0, 20) } })),
            },
          }
        : ui.kind === "list"
          ? {
              type: "list",
              body,
              ...footer,
              action: {
                button: ui.button.slice(0, 20),
                sections: [
                  {
                    title: "Options",
                    rows: ui.items.slice(0, 10).map((i) => ({
                      id: i.id,
                      title: i.title.slice(0, 24),
                      ...(i.description && { description: i.description.slice(0, 72) }),
                    })),
                  },
                ],
              },
            }
          : {
              type: "cta_url",
              body,
              ...footer,
              action: {
                name: "cta_url",
                parameters: { display_text: ui.label.slice(0, 20), url: ui.url },
              },
            }

    try {
      const { ok, data } = await graphFetch(config, `${config.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "interactive",
          interactive,
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
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error",
        permanent: false,
      }
    }
  },

  /** Verifies credentials and caches connection status on the settings row. */
  async testConnection(updatedById: string): Promise<MetaConnectionStatus> {
    let config: MetaConfig
    try {
      config = await loadConfig()
    } catch (err) {
      return {
        ok: false,
        apiStatus: "NOT_CONFIGURED",
        error: err instanceof Error ? err.message : "Not configured",
      }
    }

    try {
      const [phoneRes, wabaRes] = await Promise.all([
        graphFetch(
          config,
          `${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`
        ),
        graphFetch(config, `${config.businessAccountId}?fields=name,account_review_status`),
      ])

      if (!phoneRes.ok) {
        const result: MetaConnectionStatus = {
          ok: false,
          apiStatus: "ERROR",
          error: graphErrorMessage(phoneRes.data),
        }
        await whatsappSettingsRepository.patch({ apiStatus: "ERROR", updatedById })
        return result
      }

      const phoneStatus = String(phoneRes.data.code_verification_status ?? "CONNECTED")
      const bizStatus = wabaRes.ok
        ? String(wabaRes.data.account_review_status ?? "UNKNOWN")
        : "UNKNOWN"

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
      return {
        ok: false,
        apiStatus: "ERROR",
        error: err instanceof Error ? err.message : "Network error",
      }
    }
  },

  /**
   * Turns on Meta's welcome message: when someone opens a chat with the clinic for
   * the first time, Meta sends a `request_welcome` webhook and the bot greets them
   * before they type. `prompts` (≤4, ≤80 chars) show as tap-to-ask ice breakers.
   */
  async enableWelcomeMessage(prompts: string[]): Promise<void> {
    const config = await loadConfig()
    const { ok, data } = await graphFetch(
      config,
      `${config.phoneNumberId}/conversational_automation`,
      {
        method: "POST",
        body: JSON.stringify({ enable_welcome_message: true, prompts: prompts.slice(0, 4) }),
      }
    )
    if (!ok) throw new Error(graphErrorMessage(data))
  },

  /** Fetches all message templates registered on the WABA. */
  async fetchTemplatesFromMeta(): Promise<
    Array<{
      id: string
      name: string
      category: string
      language: string
      status: string
      components: Array<Record<string, unknown>>
    }>
  > {
    const config = await loadConfig()
    const templates: Array<{
      id: string
      name: string
      category: string
      language: string
      status: string
      components: Array<Record<string, unknown>>
    }> = []
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
  /**
   * Submits a local template to Meta for approval. With `editId` (a REJECTED
   * template's Meta id) it edits that template in place instead — Meta won't let
   * a deleted template's name be reused for 30 days.
   */
  async createTemplateOnMeta(template: WhatsAppTemplate, editId?: string): Promise<string> {
    const config = await loadConfig()

    const components: Array<Record<string, unknown>> = []
    // Header text from the editor counts as a text header (it doesn't set headerType).
    if ((template.headerType === "TEXT" || !template.headerType) && template.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: template.headerText })
    } else if (template.headerType === "DOCUMENT") {
      const handle = await uploadExampleHandle(config, samplePdf(), "sample.pdf")
      components.push({ type: "HEADER", format: "DOCUMENT", example: { header_handle: [handle] } })
    }
    const bodyComponent: Record<string, unknown> = { type: "BODY", text: template.body }
    const variables = (template.variables as string[] | null) ?? []
    if (variables.length > 0) {
      bodyComponent.example = { body_text: [variables.map((v, i) => v || `Sample ${i + 1}`)] }
    }
    components.push(bodyComponent)
    if (template.footerText) components.push({ type: "FOOTER", text: template.footerText })
    const buttons = template.buttons as Array<{ type: string; text: string; url?: string; phone_number?: string }> | null
    if (buttons?.length) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((b) => ({
          type: b.type,
          text: b.text,
          ...(b.url && { url: b.url }),
          ...(b.phone_number && { phone_number: b.phone_number }),
        })),
      })
    }

    const { ok, data } = editId
      ? await graphFetch(config, editId, {
          method: "POST",
          body: JSON.stringify({ category: template.category, components }),
        })
      : await graphFetch(config, `${config.businessAccountId}/message_templates`, {
          method: "POST",
          body: JSON.stringify({
            name: template.name,
            category: template.category,
            language: template.language,
            components,
          }),
        })
    if (!ok) throw new Error(graphErrorMessage(data))
    return editId ?? String(data.id)
  },

  /**
   * Deletes all templates with this name on Meta. Used before resubmitting a
   * REJECTED template, since Meta refuses to create a duplicate name. A missing
   * template is not an error.
   */
  async deleteTemplateOnMeta(name: string): Promise<void> {
    const config = await loadConfig()
    await graphFetch(
      config,
      `${config.businessAccountId}/message_templates?name=${encodeURIComponent(name)}`,
      {
        method: "DELETE",
      }
    )
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
