"use server"

import { headers } from "next/headers"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { generateDocumentPdf, type DocumentType } from "@/server/services/pdf.service"
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
        branch: { select: { name: true } },
        patient: { select: { fullName: true, email: true, mobile: true } },
      },
    })
    if (!est) return null
    return { docNo: est.estimateNo, branchName: est.branch.name, patient: est.patient }
  }
  if (type === "receipt") {
    const rcp = await prisma.receipt.findUnique({
      where: { id },
      select: {
        receiptNo: true,
        branch: { select: { name: true } },
        patient: { select: { fullName: true, email: true, mobile: true } },
      },
    })
    if (!rcp) return null
    return { docNo: rcp.receiptNo, branchName: rcp.branch.name, patient: rcp.patient }
  }
  const rx = await prisma.prescriptionRecord.findUnique({
    where: { id },
    select: {
      patient: { select: { patientId: true, fullName: true, email: true, mobile: true } },
      visit: { select: { branch: { select: { name: true } } } },
    },
  })
  if (!rx) return null
  return { docNo: `RX-${rx.patient.patientId}`, branchName: rx.visit.branch.name, patient: rx.patient }
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
