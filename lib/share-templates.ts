import type { DocumentType } from "@/server/services/pdf.service"

const CLINIC = process.env.NEXT_PUBLIC_CLINIC_NAME ?? "Ur's Toothfully"

export interface ShareContext {
  patientName: string
  docNo: string
  branchName?: string
}

/** Prefilled message per document type — used for both WhatsApp text and email body. */
export function buildShareMessage(type: DocumentType, ctx: ShareContext): string {
  const branch = ctx.branchName ? ` (${ctx.branchName})` : ""
  switch (type) {
    case "estimate":
      return (
        `Dear ${ctx.patientName},\n\n` +
        `Please find attached your treatment estimate ${ctx.docNo} from ${CLINIC}${branch}.\n\n` +
        `If you have any questions about the proposed treatment, feel free to call us or visit the clinic.\n\n` +
        `Warm regards,\n${CLINIC}`
      )
    case "receipt":
      return (
        `Dear ${ctx.patientName},\n\n` +
        `Thank you for your payment. Please find attached your receipt ${ctx.docNo} from ${CLINIC}${branch}.\n\n` +
        `Warm regards,\n${CLINIC}`
      )
    case "prescription":
      return (
        `Dear ${ctx.patientName},\n\n` +
        `Please find attached your prescription from ${CLINIC}${branch}.\n\n` +
        `Kindly follow the medication schedule and advice as noted. Contact us if you have any concerns.\n\n` +
        `Get well soon,\n${CLINIC}`
      )
  }
}

export function buildShareSubject(type: DocumentType, ctx: ShareContext): string {
  switch (type) {
    case "estimate": return `Your Treatment Estimate ${ctx.docNo} — ${CLINIC}`
    case "receipt": return `Payment Receipt ${ctx.docNo} — ${CLINIC}`
    case "prescription": return `Your Prescription — ${CLINIC}`
  }
}
