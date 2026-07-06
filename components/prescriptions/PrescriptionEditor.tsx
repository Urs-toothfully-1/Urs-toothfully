"use client"

import { useActionState, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { updatePrescriptionAction, PrescriptionFormState } from "@/actions/prescriptions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToothSelector } from "@/components/dental/ToothSelector"
import {
  AlertCircle, BookOpen, CheckCircle2, Loader2,
  Plus, Save, Trash2, X,
} from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import type { ExaminationFinding, PrescriptionData, PrescriptionMedicine } from "@/lib/prescription-types"
import { toast } from "sonner"

export interface ExamTemplate {
  id: string
  name: string
  finding: string
}

interface Props {
  prescriptionId: string
  data: PrescriptionData
  canEdit: boolean
  initialTemplates: ExamTemplate[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 px-6 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Prescription"}
    </Button>
  )
}

const emptyMed: PrescriptionMedicine = { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
const emptyFinding: ExaminationFinding = { toothNumbers: "", finding: "" }
const cellCls = "h-9 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white"

export function PrescriptionEditor({ prescriptionId, data, canEdit, initialTemplates }: Props) {
  const boundAction = updatePrescriptionAction.bind(null, prescriptionId)
  const [state, formAction] = useActionState(boundAction, {} as PrescriptionFormState)

  const [chiefComplaint, setChiefComplaint] = useState(data.chiefComplaint ?? "")
  const [findings, setFindings] = useState<ExaminationFinding[]>(
    data.onExamination && data.onExamination.length > 0 ? data.onExamination : [{ ...emptyFinding }]
  )
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(
    data.medicines.length > 0 ? data.medicines : [{ ...emptyMed }]
  )
  const [advice, setAdvice] = useState(data.advice ?? "")
  const [followUpDate, setFollowUpDate] = useState(data.followUpDate ?? "")

  // Template state
  const [templates, setTemplates] = useState<ExamTemplate[]>(initialTemplates)
  const [saveNameFor, setSaveNameFor] = useState<number | null>(null) // index of finding being saved as template
  const [saveName, setSaveName] = useState("")
  const [isSavingTemplate, startSaveTemplate] = useTransition()
  const [isDeletingTemplate, startDeleteTemplate] = useTransition()

  // ── Findings helpers ──────────────────────────────────────────
  function setFinding(idx: number, key: keyof ExaminationFinding, val: string) {
    setFindings((prev) => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f))
  }
  function addFinding() { setFindings((prev) => [...prev, { ...emptyFinding }]) }
  function removeFinding(idx: number) { setFindings((prev) => prev.filter((_, i) => i !== idx)) }

  function applyTemplate(template: ExamTemplate) {
    setFindings((prev) => {
      // Replace the last blank finding, or append
      const lastBlank = [...prev].reverse().findIndex((f) => !f.finding.trim())
      if (lastBlank !== -1) {
        const realIdx = prev.length - 1 - lastBlank
        return prev.map((f, i) => i === realIdx ? { ...f, finding: template.finding } : f)
      }
      return [...prev, { toothNumbers: "", finding: template.finding }]
    })
  }

  function handleSaveTemplate(idx: number) {
    const name = saveName.trim()
    if (!name) return
    const finding = findings[idx]?.finding.trim()
    if (!finding) return
    startSaveTemplate(async () => {
      try {
        const res = await fetch("/api/examination-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, finding }),
        })
        if (!res.ok) throw new Error()
        const tpl: ExamTemplate = await res.json()
        setTemplates((prev) => [...prev, tpl].sort((a, b) => a.name.localeCompare(b.name)))
        setSaveNameFor(null)
        setSaveName("")
        toast.success(`Template "${name}" saved`)
      } catch {
        toast.error("Failed to save template")
      }
    })
  }

  function handleDeleteTemplate(id: string) {
    startDeleteTemplate(async () => {
      try {
        await fetch(`/api/examination-templates?id=${id}`, { method: "DELETE" })
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        toast.success("Template deleted")
      } catch {
        toast.error("Failed to delete template")
      }
    })
  }

  // ── Medicine helpers ──────────────────────────────────────────
  function setMed(idx: number, key: keyof PrescriptionMedicine, val: string) {
    setMedicines((prev) => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m))
  }

  const payload = JSON.stringify({
    chiefComplaint: chiefComplaint.trim(),
    onExamination: findings.filter((f) => f.finding.trim()),
    medicines: medicines.filter((m) => m.name.trim()),
    advice,
    followUpDate: followUpDate || undefined,
  })

  if (!canEdit) return null

  const sectionHeader = (label: string) => (
    <h3
      className="text-xs font-bold uppercase tracking-wider py-2 px-3 rounded mb-3"
      style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
    >
      {label}
    </h3>
  )

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Prescription saved.</AlertDescription>
        </Alert>
      )}

      {/* ── 1. Chief Complaint ────────────────────────────────── */}
      <div className="space-y-2">
        {sectionHeader("Chief Complaint")}
        <Textarea
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          placeholder="Doctor's clinical chief complaint (e.g. Pain in lower left molar for 3 days, sensitivity to cold…)"
          rows={3}
          className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none"
        />
      </div>

      {/* ── 2. On Examination ────────────────────────────────── */}
      <div className="space-y-3">
        {sectionHeader("On Examination")}

        {/* Template picker */}
        {templates.length > 0 && (
          <div className="rounded-lg border border-[#E0E3E5] p-3 bg-[#F7F9FB]">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.primaryTeal }} />
              <span className="text-xs font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                Saved Templates — click to apply
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-1 rounded-full border text-xs px-2 py-1"
                  style={{ borderColor: BRAND_COLORS.borderLight, backgroundColor: "white" }}>
                  <button
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="hover:underline font-medium"
                    style={{ color: BRAND_COLORS.primaryTeal }}
                    title={tpl.finding}
                  >
                    {tpl.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    disabled={isDeletingTemplate}
                    className="ml-1 text-red-400 hover:text-red-600"
                    aria-label="Delete template"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Findings list */}
        <div className="space-y-3">
          {findings.map((f, idx) => (
            <div key={idx} className="rounded-lg border border-[#E0E3E5] p-3 bg-white space-y-2">
              {/* Finding text + tooth selector row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={f.finding}
                    onChange={(e) => setFinding(idx, "finding", e.target.value)}
                    placeholder="e.g. Deep caries noted, pulp exposure present…"
                    rows={2}
                    className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium shrink-0" style={{ color: BRAND_COLORS.borderDivider }}>
                      Tooth(s):
                    </span>
                    <ToothSelector
                      value={f.toothNumbers}
                      onChange={(val) => setFinding(idx, "toothNumbers", val)}
                      compact
                    />
                    {f.toothNumbers && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}>
                        {f.toothNumbers}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFinding(idx)}
                  className="mt-1 p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0"
                  aria-label="Remove finding"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Save as template */}
              {f.finding.trim() && (
                saveNameFor === idx ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Template name (e.g. Deep caries)"
                      className="h-8 text-xs border-[#E0E3E5] focus-visible:ring-[#0077BE] bg-white"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveTemplate(idx) } }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(idx)}
                      disabled={!saveName.trim() || isSavingTemplate}
                      className="flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
                    >
                      {isSavingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSaveNameFor(null); setSaveName("") }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setSaveNameFor(idx); setSaveName("") }}
                    className="flex items-center gap-1 text-xs hover:underline"
                    style={{ color: BRAND_COLORS.borderDivider }}
                  >
                    <Save className="h-3 w-3" />
                    Save as template
                  </button>
                )
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addFinding}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          <Plus className="h-4 w-4" />
          Add finding
        </button>
      </div>

      {/* ── 3. Medicines ─────────────────────────────────────── */}
      <div className="space-y-2">
        {sectionHeader("℞ Medicines")}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions", ""].map((h) => (
                  <th key={h} className="text-left py-1.5 px-1.5 text-xs font-semibold"
                    style={{ color: BRAND_COLORS.borderDivider }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medicines.map((m, idx) => (
                <tr key={idx}>
                  <td className="py-1 px-1.5 min-w-[160px]">
                    <Input value={m.name} onChange={(e) => setMed(idx, "name", e.target.value)}
                      placeholder="e.g. Amoxicillin 500mg" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[90px]">
                    <Input value={m.dosage} onChange={(e) => setMed(idx, "dosage", e.target.value)}
                      placeholder="1 tab" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[110px]">
                    <Input value={m.frequency} onChange={(e) => setMed(idx, "frequency", e.target.value)}
                      placeholder="1-0-1" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[90px]">
                    <Input value={m.duration} onChange={(e) => setMed(idx, "duration", e.target.value)}
                      placeholder="5 days" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[140px]">
                    <Input value={m.instructions ?? ""} onChange={(e) => setMed(idx, "instructions", e.target.value)}
                      placeholder="After food" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5">
                    <button type="button" onClick={() => setMedicines((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500" aria-label="Remove medicine">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setMedicines((prev) => [...prev, { ...emptyMed }])}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}>
          <Plus className="h-4 w-4" />Add medicine
        </button>
      </div>

      {/* ── 4. Advice + follow-up ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Advice / Instructions
          </label>
          <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)}
            placeholder="Post-treatment care, diet advice, warnings…"
            rows={3}
            className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Next Visit / Follow-up
          </label>
          <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="h-10 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white" />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <SubmitButton />
      </div>
    </form>
  )
}
