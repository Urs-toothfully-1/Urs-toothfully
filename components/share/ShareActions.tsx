"use client"

import { useState } from "react"
import { toast } from "sonner"
import { sendDocumentEmailAction } from "@/actions/share"
import { buildShareMessage } from "@/lib/share-templates"
import { toWaPhone } from "@/lib/whatsapp/provider"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import type { DocumentType } from "@/server/services/pdf.service"

interface Props {
  type: DocumentType
  /** estimate id, receipt id, or prescription-record id */
  id: string
  patientName: string
  patientMobile: string
  patientEmail?: string | null
  docNo: string
  branchName?: string
  /** compact renders icon-only buttons for table rows */
  compact?: boolean
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

async function fetchPdfFile(type: DocumentType, id: string, docNo: string): Promise<File> {
  const res = await fetch(`/api/documents/${type}/${id}/pdf`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "Failed to generate PDF")
  }
  const blob = await res.blob()
  const prefix = type.charAt(0).toUpperCase() + type.slice(1)
  return new File([blob], `${prefix}-${docNo}.pdf`, { type: "application/pdf" })
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

export function ShareActions({
  type, id, patientName, patientMobile, patientEmail, docNo, branchName, compact,
}: Props) {
  const [waBusy, setWaBusy] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [toEmail, setToEmail] = useState(patientEmail ?? "")

  const message = buildShareMessage(type, { patientName, docNo, branchName })

  async function handleWhatsApp() {
    setWaBusy(true)
    try {
      const file = await fetchPdfFile(type, id, docNo)

      // Tablets/phones: OS share sheet with the PDF attached — pick WhatsApp there
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: message })
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return // user cancelled
          // fall through to wa.me
        }
      }

      // Desktop: download the PDF, open WhatsApp chat with the text prefilled
      downloadFile(file)
      window.open(
        `https://wa.me/${toWaPhone(patientMobile)}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener"
      )
      toast.info("PDF downloaded — attach it in the WhatsApp chat that just opened.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp share failed")
    } finally {
      setWaBusy(false)
    }
  }

  async function handleEmailSend() {
    setEmailBusy(true)
    try {
      const result = await sendDocumentEmailAction({ type, id, toEmail })
      if (result.success) {
        toast.success(`Email sent to ${toEmail}`)
        setEmailOpen(false)
      } else {
        toast.error(result.error ?? "Failed to send email")
      }
    } finally {
      setEmailBusy(false)
    }
  }

  const btnBase = compact ? "h-8 w-8 p-0" : "h-9 px-3"

  return (
    <div className="flex items-center gap-2 no-print">
      <Button
        type="button"
        variant="outline"
        onClick={handleWhatsApp}
        disabled={waBusy}
        className={`${btnBase} border-[#25D366] text-[#128C4A] hover:bg-[#25D366]/10`}
        title={`Send to ${patientMobile} on WhatsApp`}
      >
        {waBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />}
        {!compact && <span className="ml-1.5 text-sm font-medium">WhatsApp</span>}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => setEmailOpen(true)}
        className={btnBase}
        style={{ borderColor: BRAND_COLORS.primaryTeal, color: BRAND_COLORS.primaryTeal }}
        title={patientEmail ? `Email to ${patientEmail}` : "Email document"}
      >
        <Mail className="h-4 w-4" />
        {!compact && <span className="ml-1.5 text-sm font-medium">Email</span>}
      </Button>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email {type} to patient</DialogTitle>
            <DialogDescription>
              The PDF of {docNo} will be attached automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="share-email">Recipient</Label>
              <Input
                id="share-email"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="patient@example.com"
              />
              {!patientEmail && (
                <p className="text-xs text-amber-600">
                  No email on file for {patientName} — enter one to send.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <p className="text-xs whitespace-pre-line rounded-md border p-2.5 max-h-40 overflow-y-auto"
                 style={{ color: BRAND_COLORS.secondaryText, borderColor: BRAND_COLORS.borderLight }}>
                {message}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEmailSend}
              disabled={emailBusy || !toEmail}
              className="text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {emailBusy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
