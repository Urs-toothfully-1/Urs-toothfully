"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveVisitClinicalNotesAction } from "@/actions/prescriptions"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Plus, Trash2, Loader2, Printer } from "lucide-react"
import type { ClinicalNoteEntry } from "@/lib/prescription-types"

interface Props {
  /** Visit whose prescription holds the accumulating clinical-notes log */
  visitId: string
  initialNotes: ClinicalNoteEntry[]
  /** true once a prescription exists → enables the print preview */
  hasPrescription: boolean
}

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function SessionClinicalNotes({ visitId, initialNotes, hasPrescription }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState<ClinicalNoteEntry[]>(initialNotes)
  const [saving, start] = useTransition()
  const [saved, setSaved] = useState(hasPrescription)
  const today = new Date().toISOString().slice(0, 10)

  function add() { setNotes((p) => [...p, { date: today, note: "" }]) }
  function edit(i: number, note: string) { setNotes((p) => p.map((n, idx) => (idx === i ? { ...n, note } : n))) }
  function remove(i: number) { setNotes((p) => p.filter((_, idx) => idx !== i)) }

  function save() {
    const clean = notes.filter((n) => n.note.trim())
    if (clean.length === 0) { toast.error("Write a note before saving"); return }
    start(async () => {
      const res = await saveVisitClinicalNotesAction(visitId, clean)
      if (res.success) { toast.success("Clinical notes saved to the prescription"); setSaved(true); router.refresh() }
      else toast.error(res.error ?? "Failed to save")
    })
  }

  return (
    <Card className="border-[#E0E3E5]">
      <CardHeader className="pb-3 border-b flex-row items-center justify-between" style={{ borderColor: "#F2F4F6" }}>
        <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
          <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
          Clinical Notes
        </CardTitle>
        {saved && (
          <a href={`/print/prescription/${visitId}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
            <Printer className="h-3.5 w-3.5" /> Preview / Print
          </a>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          Record what was done today. Notes are added to the patient&apos;s prescription and print after the Rx —
          continuing to a new page (header + footer only) if the sheet fills up. Use <strong>Preview / Print</strong> to check.
        </p>

        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs font-semibold font-mono mt-2.5 shrink-0 w-24" style={{ color: BRAND_COLORS.primaryTeal }}>{fmt(n.date)}</span>
                <Textarea
                  value={n.note}
                  onChange={(e) => edit(i, e.target.value)}
                  placeholder="e.g. Access opening & pulpectomy done on 46; dressing placed…"
                  rows={2}
                  className="flex-1 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none"
                />
                <button type="button" onClick={() => remove(i)} className="mt-2 p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0" aria-label="Remove note">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
            <Plus className="h-4 w-4" />Add today&apos;s note ({new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
          </button>
          <Button type="button" onClick={save} disabled={saving} className="h-9 ml-auto text-white" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save Notes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
