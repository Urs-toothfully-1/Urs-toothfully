"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updatePrescriptionAction, saveNewVisitPrescriptionAction } from "@/actions/prescriptions"
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
import type { ClinicalNoteEntry, ExaminationFinding, PrescriptionData, PrescriptionMedicine, PrescriptionTreatment } from "@/lib/prescription-types"
import { toast } from "sonner"

export interface ExamTemplate {
  id: string
  name: string
  finding: string
}

export interface TreatmentOption {
  id: string
  category: string
  name: string
  defaultAmount: number
}

interface Props {
  prescriptionId: string
  data: PrescriptionData
  canEdit: boolean
  initialTemplates: ExamTemplate[]
  /** Treatment master list — enables the editable Treatment Plan section */
  treatments?: TreatmentOption[]
  /** Submit label override (e.g. "Save & Finish Consultation") */
  submitLabel?: string
  onSaveSuccess?: () => void
  /** Fires whenever the treatment plan changes, so a parent wizard can carry it into the estimate */
  onTreatmentsChange?: (treatments: PrescriptionTreatment[]) => void
  /** The patient's previous prescription — enables a "Load from last visit" shortcut */
  previousData?: Pick<PrescriptionData, "chiefComplaint" | "onExamination" | "treatments" | "medicines" | "advice"> | null
  /** Create-on-save mode: no record exists yet; only created when the doctor saves real data. */
  newForVisitId?: string
}

export interface PrescriptionEditorHandle {
  /** Saves the prescription and resolves true on success. */
  save: () => Promise<boolean>
}

const emptyMed: PrescriptionMedicine = { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
const emptyFinding: ExaminationFinding = { toothNumbers: "", finding: "" }
const emptyTreatment: PrescriptionTreatment = { treatmentName: "", category: "OTHER", toothNumber: "", quantity: 1 }
const cellCls = "h-9 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white"

export const PrescriptionEditor = forwardRef<PrescriptionEditorHandle, Props>(function PrescriptionEditor(
  { prescriptionId, data, canEdit, initialTemplates, treatments = [], submitLabel, onSaveSuccess, onTreatmentsChange, previousData, newForVisitId }: Props,
  ref
) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [chiefComplaint, setChiefComplaint] = useState(data.chiefComplaint ?? "")
  const [findings, setFindings] = useState<ExaminationFinding[]>(
    data.onExamination && data.onExamination.length > 0 ? data.onExamination : [{ ...emptyFinding }]
  )
  const [treatmentPlan, setTreatmentPlan] = useState<PrescriptionTreatment[]>(
    data.treatments && data.treatments.length > 0 ? data.treatments : [{ ...emptyTreatment }]
  )
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(
    data.medicines.length > 0 ? data.medicines : [{ ...emptyMed }]
  )
  const [advice, setAdvice] = useState(data.advice ?? "")
  const [followUpDate, setFollowUpDate] = useState(data.followUpDate ?? "")
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNoteEntry[]>(data.clinicalNotes ?? [])

  const todayStr = new Date().toISOString().slice(0, 10)
  function addClinicalNote() {
    setClinicalNotes((prev) => [...prev, { date: todayStr, note: "" }])
  }
  function setClinicalNote(idx: number, note: string) {
    setClinicalNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, note } : n)))
  }
  function removeClinicalNote(idx: number) {
    setClinicalNotes((prev) => prev.filter((_, i) => i !== idx))
  }

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

  // ── Treatment plan helpers ────────────────────────────────────
  const treatmentsByCategory = treatments.reduce<Record<string, TreatmentOption[]>>((acc, t) => {
    ;(acc[t.category] ??= []).push(t)
    return acc
  }, {})

  function setTreatment<K extends keyof PrescriptionTreatment>(idx: number, key: K, val: PrescriptionTreatment[K]) {
    setTreatmentPlan((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)))
  }
  function selectTreatmentMaster(idx: number, treatmentId: string) {
    const t = treatments.find((x) => x.id === treatmentId)
    setTreatmentPlan((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              treatmentId: t?.id ?? undefined,
              treatmentName: t?.name ?? row.treatmentName,
              category: t?.category ?? row.category,
            }
          : row
      )
    )
  }
  function addTreatment() { setTreatmentPlan((prev) => [...prev, { ...emptyTreatment }]) }
  function removeTreatment(idx: number) { setTreatmentPlan((prev) => prev.filter((_, i) => i !== idx)) }

  // ── Medicine helpers ──────────────────────────────────────────
  function setMed(idx: number, key: keyof PrescriptionMedicine, val: string) {
    setMedicines((prev) => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m))
  }

  const cleanTreatments = treatmentPlan
    .filter((t) => t.treatmentName.trim())
    .map((t) => ({
      treatmentId: t.treatmentId || undefined,
      treatmentName: t.treatmentName.trim(),
      category: t.category || "OTHER",
      toothNumber: t.toothNumber || undefined,
      quantity: Number(t.quantity) || 1,
    }))

  const payload = JSON.stringify({
    chiefComplaint: chiefComplaint.trim(),
    onExamination: findings.filter((f) => f.finding.trim()),
    treatments: cleanTreatments,
    medicines: medicines.filter((m) => m.name.trim()),
    advice,
    followUpDate: followUpDate || undefined,
    clinicalNotes: clinicalNotes.filter((n) => n.note.trim()),
  })

  // Report treatment-plan changes up so a parent wizard can prefill the estimate.
  useEffect(() => {
    onTreatmentsChange?.(cleanTreatments)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  async function doSave(): Promise<boolean> {
    setSaveError(null)
    setSaved(false)
    const fd = new FormData()
    fd.set("payload", payload)
    return new Promise<boolean>((resolve) => {
      startSaving(async () => {
        // Create-on-save: the record is created only now, with the entered data.
        if (newForVisitId && !prescriptionId) {
          const result = await saveNewVisitPrescriptionAction(newForVisitId, {}, fd)
          if (result.success && result.prescriptionId) {
            onSaveSuccess?.()
            router.replace(`/doctor/prescription/${result.prescriptionId}`)
            resolve(true)
          } else {
            setSaveError(result.error ?? "Failed to save prescription.")
            resolve(false)
          }
          return
        }
        const result = await updatePrescriptionAction(prescriptionId, {}, fd)
        if (result.success) {
          setSaved(true)
          onSaveSuccess?.()
          resolve(true)
        } else {
          setSaveError(result.error ?? "Failed to save prescription.")
          resolve(false)
        }
      })
    })
  }

  useImperativeHandle(ref, () => ({ save: doSave }))

  function loadFromPrevious() {
    if (!previousData) return
    if (previousData.chiefComplaint) setChiefComplaint(previousData.chiefComplaint)
    if (previousData.onExamination && previousData.onExamination.length) setFindings(previousData.onExamination.map((f) => ({ ...f })))
    if (previousData.treatments && previousData.treatments.length) setTreatmentPlan(previousData.treatments.map((t) => ({ ...t })))
    if (previousData.medicines && previousData.medicines.length) setMedicines(previousData.medicines.map((m) => ({ ...m })))
    if (previousData.advice) setAdvice(previousData.advice)
    toast.success("Loaded from the patient's last prescription — edit as needed and save")
  }

  const hasPrevious = !!(
    previousData &&
    ((previousData.treatments?.length ?? 0) > 0 ||
      (previousData.medicines?.length ?? 0) > 0 ||
      (previousData.onExamination?.length ?? 0) > 0 ||
      previousData.chiefComplaint)
  )

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
    <form onSubmit={(e) => { e.preventDefault(); doSave() }} className="space-y-6">
      {hasPrevious && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3"
          style={{ borderColor: BRAND_COLORS.lightBackground, backgroundColor: "#F7F9FB" }}>
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            This patient has a prescription from a previous visit. Continue it, or leave blank to write a fresh one.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={loadFromPrevious} className="gap-1.5 text-xs shrink-0">
            <BookOpen className="h-3.5 w-3.5" />
            Load from last prescription
          </Button>
        </div>
      )}
      {saveError && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {saved && (
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

      {/* ── 3. Treatment Plan ────────────────────────────────── */}
      <div className="space-y-3">
        {sectionHeader("Treatment Plan")}
        <p className="text-xs -mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
          Add the treatments the patient needs. These carry over to the estimate in the next step (no prices here).
        </p>
        <div className="space-y-2">
          {treatmentPlan.map((t, idx) => (
            <div key={idx} className="rounded-lg border border-[#E0E3E5] p-3 bg-white">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                  {/* Treatment picker + name */}
                  <div className="md:col-span-6 space-y-1.5">
                    {treatments.length > 0 && (
                      <select
                        className="w-full h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"
                        value={t.treatmentId ?? ""}
                        onChange={(e) => selectTreatmentMaster(idx, e.target.value)}
                      >
                        <option value="">— Select treatment —</option>
                        {Object.entries(treatmentsByCategory).map(([cat, treats]) => (
                          <optgroup key={cat} label={cat}>
                            {treats.map((tr) => (
                              <option key={tr.id} value={tr.id}>
                                {tr.name} (₹{tr.defaultAmount.toLocaleString("en-IN")})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                    <Input
                      value={t.treatmentName}
                      onChange={(e) => setTreatment(idx, "treatmentName", e.target.value)}
                      placeholder="Treatment name (e.g. Root Canal Treatment)"
                      className={cellCls}
                    />
                  </div>
                  {/* Tooth */}
                  <div className="md:col-span-4 flex items-center gap-2">
                    <span className="text-xs font-medium shrink-0" style={{ color: BRAND_COLORS.borderDivider }}>
                      Tooth(s):
                    </span>
                    <ToothSelector
                      value={t.toothNumber ?? ""}
                      onChange={(val) => setTreatment(idx, "toothNumber", val)}
                      compact
                    />
                  </div>
                  {/* Qty */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <span className="text-xs font-medium shrink-0" style={{ color: BRAND_COLORS.borderDivider }}>Qty</span>
                    <Input
                      type="number"
                      min={1}
                      value={t.quantity}
                      onChange={(e) => setTreatment(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                      className={`${cellCls} text-center`}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTreatment(idx)}
                  className="mt-1 p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0"
                  aria-label="Remove treatment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTreatment}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          <Plus className="h-4 w-4" />
          Add treatment
        </button>
      </div>

      {/* ── 4. Medicines ─────────────────────────────────────── */}
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

      {/* ── 5. Clinical Notes (dated) ─────────────────────────── */}
      <div className="space-y-3">
        {sectionHeader("Clinical Notes — what was done")}
        <p className="text-xs -mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
          Add a dated note each visit. These print after the Rx (Prescription — Clinical Notes), continuing to a new page if the sheet fills up.
        </p>
        {clinicalNotes.length > 0 && (
          <div className="space-y-2">
            {clinicalNotes.map((n, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-semibold font-mono mt-2.5 shrink-0 w-24" style={{ color: BRAND_COLORS.primaryTeal }}>
                  {new Date(`${n.date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <Textarea
                  value={n.note}
                  onChange={(e) => setClinicalNote(idx, e.target.value)}
                  placeholder="e.g. Access opening & pulpectomy done on 46, dressing placed…"
                  rows={2}
                  className="flex-1 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none"
                />
                <button type="button" onClick={() => removeClinicalNote(idx)}
                  className="mt-2 p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0" aria-label="Remove note">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addClinicalNote}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}>
          <Plus className="h-4 w-4" />Add today&apos;s note ({new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
        </button>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <Button
          type="submit"
          disabled={saving}
          className="h-10 px-6 font-semibold text-white"
          style={{ backgroundColor: saving ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
        >
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : (submitLabel ?? "Save Prescription")}
        </Button>
      </div>
    </form>
  )
})
