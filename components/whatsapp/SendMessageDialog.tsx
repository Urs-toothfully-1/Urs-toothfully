"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { sendWhatsAppMessageAction } from "@/actions/whatsapp"
import { renderTemplateBody } from "@/lib/whatsapp/templates"
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Search, Send, User, X } from "lucide-react"

export interface TemplateOption {
  id: string
  displayName: string
  status: string
  body: string
  variables: string[]
}

interface PatientHit {
  id: string
  patientId: string
  fullName: string
  mobile: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: TemplateOption[]
}

const labelCls = "block text-sm font-medium mb-1"

export function SendMessageDialog({ open, onOpenChange, templates }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<PatientHit[]>([])
  const [patient, setPatient] = useState<PatientHit | null>(null)
  const [templateId, setTemplateId] = useState("")
  const [values, setValues] = useState<string[]>([])

  const template = templates.find((t) => t.id === templateId) ?? null

  const search = useDebouncedCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setHits([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/patients?q=${encodeURIComponent(term.trim())}`)
      const data = await res.json()
      setHits((data.patients ?? []).slice(0, 8))
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }, 300)

  function selectTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    setValues(t ? t.variables.map((v) => (v === "Patient Name" && patient ? patient.fullName : "")) : [])
  }

  function reset() {
    setPatient(null)
    setHits([])
    setTemplateId("")
    setValues([])
  }

  function handleSend() {
    if (!patient || !template) return
    startTransition(async () => {
      const result = await sendWhatsAppMessageAction({
        patientId: patient.id,
        templateId: template.id,
        variables: values,
      })
      if (result.success) {
        toast.success(result.message)
        reset()
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to queue message")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient picker */}
          <div>
            <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
              Patient <span className="text-red-500">*</span>
            </label>
            {patient ? (
              <div className="flex items-center justify-between p-3 rounded-md border border-[#E0E3E5] bg-[#F7F9FB]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <User className="h-4 w-4 flex-shrink-0" style={{ color: BRAND_COLORS.primaryTeal }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: BRAND_COLORS.bodyText }}>{patient.fullName}</p>
                    <p className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{patient.patientId} · {patient.mobile}</p>
                  </div>
                </div>
                <button onClick={() => setPatient(null)} className="p-2 rounded hover:bg-gray-100" aria-label="Change patient">
                  <X className="h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  {searching ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" style={{ color: BRAND_COLORS.primaryTeal }} />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
                  )}
                  <Input
                    onChange={(e) => search(e.target.value)}
                    placeholder="Search by name, mobile or patient ID…"
                    className="pl-9 border-[#E0E3E5] bg-[#F2F4F6]"
                  />
                </div>
                {hits.length > 0 && (
                  <ul className="mt-1 rounded-md border border-[#E0E3E5] bg-white divide-y divide-[#F2F4F6] max-h-52 overflow-y-auto">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          onClick={() => { setPatient(h); setHits([]) }}
                          className="w-full text-left px-3 py-2.5 hover:bg-[#F7F9FB] transition-colors"
                        >
                          <span className="text-sm font-medium block" style={{ color: BRAND_COLORS.bodyText }}>{h.fullName}</span>
                          <span className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{h.patientId} · {h.mobile}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="text-xs mt-1" style={{ color: BRAND_COLORS.sidebarMuted }}>
              Messages require WhatsApp consent and a paid consultation fee.
            </p>
          </div>

          {/* Template picker */}
          <div>
            <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
              Template <span className="text-red-500">*</span>
            </label>
            <select
              value={templateId}
              onChange={(e) => selectTemplate(e.target.value)}
              className="w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm"
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}{t.status !== "APPROVED" ? ` (${t.status.toLowerCase()})` : ""}
                </option>
              ))}
            </select>
            {template && template.status !== "APPROVED" && (
              <p className="text-xs mt-1 text-amber-700">
                This template is not yet approved by Meta — sending may fail until approval.
              </p>
            )}
          </div>

          {/* Variables */}
          {template && template.variables.length > 0 && (
            <div className="space-y-3">
              {template.variables.map((label, i) => (
                <div key={`${label}-${i}`}>
                  <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                    {label} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={values[i] ?? ""}
                    onChange={(e) => {
                      const next = [...values]
                      next[i] = e.target.value
                      setValues(next)
                    }}
                    placeholder={label}
                    className="border-[#E0E3E5] bg-[#F2F4F6]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {template && (
            <div className="rounded-lg p-3 border" style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#166534" }}>
                Preview
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: BRAND_COLORS.bodyText }}>
                {renderTemplateBody(template.body, values.map((v, i) => v || `[${template.variables[i] ?? "…"}]`))}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              isPending || !patient || !template ||
              (template.variables.length > 0 && template.variables.some((_, i) => !(values[i] ?? "").trim()))
            }
            className="text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Queue Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
