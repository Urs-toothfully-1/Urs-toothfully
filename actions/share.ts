"use server"

import { headers } from "next/headers"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { documentAccessError, generateDocumentPdf, type DocumentType } from "@/server/services/pdf.service"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { whatsappInboxService } from "@/server/services/whatsapp/inbox.service"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { whatsappTemplateRepository } from "@/server/repositories/whatsapp-template.repository"
import { validateMobile } from "@/lib/whatsapp/phone"
import { WHATSAPP_TRIGGERS, renderTemplateBody } from "@/lib/whatsapp/templates"
import { sendEmailWithAttachment } from "@/server/services/email.service"
import { buildShareMessage, buildShareSubject } from "@/lib/share-templates"
import { z } from "zod"

export type ShareResult = {
  success?: boolean
  error?: string
}

const VALID_TYPES: DocumentType[] = ["estimate", "receipt", "prescription"]

/** Patient + document metadata needed to address and word the message. */
async function resolveShareContext(type: DocumentType, id: string) {
  if (type === "estimate") {
    const est = await prisma.estimate.findUnique({
      where: { id, isDeleted: false },
      select: {
        estimateNo: true,
        branchId: true,
        branch: { select: { name: true } },
        patient: { select: { id: true, fullName: true, email: true, mobile: true } },
      },
    })
    if (!est) return null
    return { docNo: est.estimateNo, branchId: est.branchId, branchName: est.branch.name, patient: est.patient }
  }
  if (type === "receipt") {
    const rcp = await prisma.receipt.findUnique({
      where: { id },
      select: {
        receiptNo: true,
        branchId: true,
        branch: { select: { name: true } },
        patient: { select: { id: true, fullName: true, email: true, mobile: true } },
      },
    })
    if (!rcp) return null
    return { docNo: rcp.receiptNo, branchId: rcp.branchId, branchName: rcp.branch.name, patient: rcp.patient }
  }
  const rx = await prisma.prescriptionRecord.findUnique({
    where: { id },
    select: {
      patient: { select: { id: true, patientId: true, fullName: true, email: true, mobile: true } },
      visit: { select: { branchId: true, branch: { select: { name: true } } } },
    },
  })
  if (!rx) return null
  return {
    docNo: `RX-${rx.patient.patientId}`,
    branchId: rx.visit.branchId,
    branchName: rx.visit.branch.name,
    patient: rx.patient,
  }
}

const emailInputSchema = z.object({
  type: z.enum(["estimate", "receipt", "prescription"]),
  id: z.string().uuid(),
  toEmail: z.string().email(),
})

/** Emails the document PDF to the patient (Gmail SMTP). */
export async function sendDocumentEmailAction(input: {
  type: DocumentType
  id: string
  toEmail: string
}): Promise<ShareResult> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = emailInputSchema.safeParse(input)
  if (!parsed.success) return { error: "Please provide a valid email address." }
  const { type, id, toEmail } = parsed.data
  if (await documentAccessError(session, type, id)) return { error: "You don't have access to this document." }

  const ctx = await resolveShareContext(type, id)
  if (!ctx) return { error: "Document not found." }

  const hdrs = await headers()
  const host = hdrs.get("host")
  if (!host) return { error: "Could not determine server address." }
  const proto = hdrs.get("x-forwarded-proto") ?? "http"

  try {
    const { buffer, fileName } = await generateDocumentPdf({
      type,
      id,
      baseUrl: `${proto}://${host}`,
      cookieHeader: hdrs.get("cookie") ?? "",
      generatedById: session.userId,
    })

    await sendEmailWithAttachment({
      to: toEmail,
      subject: buildShareSubject(type, { patientName: ctx.patient.fullName, docNo: ctx.docNo, branchName: ctx.branchName }),
      text: buildShareMessage(type, { patientName: ctx.patient.fullName, docNo: ctx.docNo, branchName: ctx.branchName }),
      attachment: { filename: fileName, content: buffer },
    })

    await createAuditLog({
      entityType: "GeneratedDocument",
      entityId: id,
      action: "EXPORT",
      changedById: session.userId,
      newValues: { channel: "email", documentType: type, docNo: ctx.docNo, to: toEmail },
    })

    return { success: true }
  } catch (err) {
    console.error("Email share failed:", err)
    const msg = err instanceof Error && err.message.includes("not configured")
      ? err.message
      : "Failed to send email. Please check the address and try again."
    return { error: msg }
  }
}

/** Metadata the client-side share buttons need (message text, patient contact). */
export async function getShareInfoAction(input: {
  type: DocumentType
  id: string
}): Promise<
  | { error: string }
  | { message: string; patientEmail: string | null; patientMobile: string; docNo: string }
> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  if (!VALID_TYPES.includes(input.type)) return { error: "Invalid document type" }

  const ctx = await resolveShareContext(input.type, input.id)
  if (!ctx) return { error: "Document not found." }

  return {
    message: buildShareMessage(input.type, {
      patientName: ctx.patient.fullName,
      docNo: ctx.docNo,
      branchName: ctx.branchName,
    }),
    patientEmail: ctx.patient.email ?? null,
    patientMobile: ctx.patient.mobile,
    docNo: ctx.docNo,
  }
}

// ─── WhatsApp: send the PDF from the clinic number ─────────────────────────

const DOC_LABEL: Record<DocumentType, string> = {
  prescription: "prescription",
  receipt: "payment receipt",
  estimate: "treatment estimate",
}

const FILE_PREFIX: Record<DocumentType, string> = {
  prescription: "Prescription",
  receipt: "Receipt",
  estimate: "Estimate",
}

/** True when the patient messaged the clinic in the last 24h (free session window). */
async function windowOpen(phone: string): Promise<boolean> {
  const last = await prisma.whatsAppInbound.findFirst({
    where: {
      fromPhone: phone,
      direction: "IN",
      receivedAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    select: { id: true },
  })
  return Boolean(last)
}

export type WhatsAppSendInfo = {
  /** Clinic number connected to the WhatsApp Cloud API. */
  configured: boolean
  sendingEnabled: boolean
  hasConsent: boolean
  /** Patient wrote in the last 24h: send free, no template needed. */
  windowOpen: boolean
  /** document_share template approved by Meta (needed outside the 24h window). */
  templateApproved: boolean
  phoneValid: boolean
  /** Message text exactly as the patient will see it with the PDF. */
  caption: string
  fileName: string
}

/** Typed failure, so `"error" in result` narrows the union. */
const fail = (error: string): { error: string } => ({ error })

async function loadSendContext(type: DocumentType, id: string) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]).catch(() => null)
  if (!session) return fail("Unauthorized")
  if (!VALID_TYPES.includes(type)) return fail("Invalid document type")
  if (await documentAccessError(session, type, id))
    return fail("You don't have access to this document.")
  const ctx = await resolveShareContext(type, id)
  if (!ctx) return fail("Document not found.")

  const [settings, configured, template] = await Promise.all([
    whatsappSettingsRepository.get(),
    metaService.isConfigured(),
    whatsappTemplateRepository.findByTriggerKey(WHATSAPP_TRIGGERS.DOCUMENT_SHARE),
  ])
  const phone = validateMobile(ctx.patient.mobile, settings?.defaultCountryCode ?? "91")
  const values = [ctx.patient.fullName, DOC_LABEL[type], ctx.docNo]
  const body =
    template?.body ??
    "Dear {{1}},\n\nPlease find your *{{2}}* from *Ur's Toothfully* attached (Ref: {{3}})."
  return {
    session,
    ctx,
    settings,
    configured,
    template,
    templateApproved: template?.status === "APPROVED" && template.isEnabled,
    phone: phone.valid && phone.normalized ? phone.normalized : null,
    values,
    caption: renderTemplateBody(body, values),
    fileName: `${FILE_PREFIX[type]}-${ctx.docNo}.pdf`,
  }
}

/** What the send dialog should show for this document and patient. */
export async function getWhatsAppSendInfoAction(input: {
  type: DocumentType
  id: string
}): Promise<{ error: string } | WhatsAppSendInfo> {
  const c = await loadSendContext(input.type, input.id)
  if ("error" in c) return { error: c.error }
  return {
    configured: c.configured,
    sendingEnabled: c.settings?.sendingEnabled ?? true,
    hasConsent: await whatsappService.hasConsent(c.ctx.patient.id),
    windowOpen: c.phone ? await windowOpen(c.phone) : false,
    templateApproved: c.templateApproved,
    phoneValid: Boolean(c.phone),
    caption: c.caption,
    fileName: c.fileName,
  }
}

/**
 * Sends the document PDF to the patient from the clinic's WhatsApp number.
 * Inside the 24h window it goes as a free document message; otherwise through
 * the approved document_share template. Logged for delivery/read ticks and
 * shown in the inbox thread.
 */
export async function sendDocumentWhatsAppAction(input: {
  type: DocumentType
  id: string
  /** Staff confirmed the patient agreed to receive WhatsApp messages. */
  confirmConsent?: boolean
}): Promise<ShareResult> {
  const c = await loadSendContext(input.type, input.id)
  if ("error" in c) return { error: c.error }
  const { session, ctx, phone } = c

  if (!c.configured) return { error: "The clinic WhatsApp number is not connected." }
  if (c.settings && !c.settings.sendingEnabled)
    return { error: "WhatsApp sending is switched off (emergency stop)." }
  if (!phone) return { error: `${ctx.patient.fullName}'s mobile number is not valid for WhatsApp.` }

  if (!(await whatsappService.hasConsent(ctx.patient.id))) {
    if (!input.confirmConsent)
      return { error: "Please confirm the patient agreed to receive WhatsApp messages." }
    await whatsappService.setConsent(ctx.patient.id, true)
  }

  // Outside the 24h window Meta only delivers approved templates.
  const inWindow = await windowOpen(phone)
  if (!inWindow && !c.templateApproved) {
    return {
      error:
        "The PDF message template is still waiting for Meta approval. Use “Share from this device” for now, or send once the patient has messaged the clinic.",
    }
  }
  // Prefer the approved template even inside the 24h window: it carries the
  // Call clinic / Visit website buttons the text refers to, and Meta doesn't
  // charge for utility templates while the chat window is open. The plain
  // document message is only the fallback before the template is approved.
  const viaTemplate = c.templateApproved ? c.template : null

  const hdrs = await headers()
  try {
    const pdf = await generateDocumentPdf({
      type: input.type,
      id: input.id,
      baseUrl: `${hdrs.get("x-forwarded-proto") ?? "http"}://${hdrs.get("host")}`,
      cookieHeader: hdrs.get("cookie") ?? "",
      generatedById: session.userId,
    })
    const mediaId = await metaService.uploadMedia(pdf.buffer, c.fileName)
    const result = viaTemplate
      ? await metaService.sendTemplateMessage({
          to: phone,
          templateName: viaTemplate.name,
          language: viaTemplate.language,
          bodyValues: c.values,
          headerDocument: { id: mediaId, filename: c.fileName },
        })
      : await metaService.sendDocumentMessage(phone, {
          id: mediaId,
          filename: c.fileName,
          // No buttons on a plain document message — point to the number instead.
          caption: c.caption.replace(/tap \*Call clinic\* below/i, "call us on 7890008331"),
        })

    await prisma.whatsAppMessage.create({
      data: {
        patientId: ctx.patient.id,
        branchId: ctx.branchId,
        templateId: viaTemplate?.id ?? null,
        templateName: viaTemplate?.name ?? "document",
        toPhone: phone,
        variables: c.values,
        status: result.success ? "SENT" : "FAILED",
        attemptCount: 1,
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        failureReason: result.error,
        metaMessageId: result.metaMessageId,
        createdById: session.userId,
      },
    })
    if (!result.success) return { error: `WhatsApp did not accept the message: ${result.error}` }

    await whatsappInboxService.logOutbound({
      phone,
      text: `📄 ${c.fileName}\n${c.caption}`,
      sentById: session.userId,
      patientId: ctx.patient.id,
    })
    await createAuditLog({
      entityType: "GeneratedDocument",
      entityId: input.id,
      action: "EXPORT",
      changedById: session.userId,
      newValues: {
        channel: "whatsapp",
        documentType: input.type,
        docNo: ctx.docNo,
        to: phone,
        viaTemplate: Boolean(viaTemplate),
      },
    })
    return { success: true }
  } catch (err) {
    console.error("WhatsApp document send failed:", err)
    return { error: err instanceof Error ? err.message : "Failed to send on WhatsApp" }
  }
}
