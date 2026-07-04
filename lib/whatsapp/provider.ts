/**
 * WhatsApp sending abstraction.
 *
 * Today the clinic uses the "share" provider: the browser downloads the PDF
 * and hands it to WhatsApp via the OS share sheet (tablets) or a wa.me link
 * with prefilled text (desktop). That flow lives client-side in
 * components/share/ShareActions.tsx — there is nothing to send from the server.
 *
 * When the clinic adopts the Meta WhatsApp Cloud API, implement
 * CloudApiWhatsAppProvider below and flip WHATSAPP_PROVIDER=cloud-api; the
 * ShareActions component then calls a server action that routes through
 * getWhatsAppProvider().sendDocument(...) instead of the share sheet.
 */

export interface WhatsAppSendResult {
  success: boolean
  error?: string
}

export interface WhatsAppProvider {
  /** True when the server can deliver the message itself. */
  canSendServerSide: boolean
  sendDocument(opts: {
    /** E.164 number without "+", e.g. "919876543210" */
    toPhone: string
    message: string
    pdf: { fileName: string; content: Buffer }
  }): Promise<WhatsAppSendResult>
}

class ShareSheetWhatsAppProvider implements WhatsAppProvider {
  canSendServerSide = false
  async sendDocument(): Promise<WhatsAppSendResult> {
    return {
      success: false,
      error: "The share provider sends from the device, not the server.",
    }
  }
}

class CloudApiWhatsAppProvider implements WhatsAppProvider {
  canSendServerSide = true
  async sendDocument(): Promise<WhatsAppSendResult> {
    // TODO: Meta Cloud API — upload media, send document template message.
    // Requires WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN env vars.
    return { success: false, error: "WhatsApp Cloud API is not configured yet." }
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === "cloud-api"
    ? new CloudApiWhatsAppProvider()
    : new ShareSheetWhatsAppProvider()
}

/** Normalises an Indian mobile number for wa.me links (adds 91 to 10-digit numbers). */
export function toWaPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, "")
  return digits.length === 10 ? `91${digits}` : digits
}
