"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Pill, Stethoscope } from "lucide-react"
import { LibraryPickerDialog, type LibraryItem } from "./LibraryPickerDialog"
import { ToothSelectorDialog } from "./ToothSelectorDialog"
import { MedicineTemplateSelector, type MedicineTemplate } from "./MedicineTemplateSelector"
import { createCustomDiagnosisAction } from "@/actions/diagnoses"
import { saveQuickRxAction } from "@/actions/prescriptions"
import { BRAND_COLORS } from "@/lib/constants"
import { toast } from "sonner"

interface QuickRxDiagnosis {
  diagnosisId?: string
  specialty: string
  diagnosisText: string
  toothNumbers: string[]
}

interface QuickRxMedicine {
  name: string
  dosage: string
  frequency: string
  duration: string
}

interface Props {
  visitId: string
  onSuccess?: (prescriptionId: string) => void
  onClose: () => void
}

export function QuickRxModal({ visitId, onSuccess, onClose }: Props) {
  const [diagnoses, setDiagnoses] = useState<QuickRxDiagnosis[]>([])
  const [medicines, setMedicines] = useState<QuickRxMedicine[]>([])
  const [showDiagnosisPicker, setShowDiagnosisPicker] = useState(false)
  const [toothEditIndex, setToothEditIndex] = useState<number | null>(null)
  const [showMedicineSelector, setShowMedicineSelector] = useState(false)
  const [showMedicinePicker, setShowMedicinePicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAddDiagnosis = (item: LibraryItem) => {
    setDiagnoses((prev) => {
      if (prev.some((d) => d.diagnosisText.toLowerCase() === item.name.toLowerCase())) return prev
      return [
        ...prev,
        { diagnosisId: item.id, specialty: item.group, diagnosisText: item.name, toothNumbers: [] },
      ]
    })
  }

  const handleCreateDiagnosis = async (name: string) => {
    const result = await createCustomDiagnosisAction(name, "General Dentistry / Restorative", "DIAGNOSIS")
    if (!result.success || !result.diagnosis) {
      toast.error(result.error ?? "Could not save to library")
      return
    }
    handleAddDiagnosis({
      id: result.diagnosis.id,
      name: result.diagnosis.name,
      group: result.diagnosis.specialty,
    })
    toast.success(`"${result.diagnosis.name}" saved to the library`)
  }

  const handlePickMedicine = (item: LibraryItem) => {
    setMedicines((prev) => {
      if (prev.some((m) => m.name.trim().toLowerCase() === item.name.toLowerCase())) return prev
      return [...prev.filter((m) => m.name.trim()), { name: item.name, dosage: "", frequency: "", duration: "" }]
    })
  }

  const updateDiagnosis = (index: number, patch: Partial<QuickRxDiagnosis>) => {
    setDiagnoses((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  const handleSelectTeeth = (toothNumbers: string[]) => {
    if (toothEditIndex !== null) updateDiagnosis(toothEditIndex, { toothNumbers })
    setToothEditIndex(null)
  }

  // Template medicines are added to the list, never replacing what is already
  // there — a doctor may combine two protocols. Duplicates by name are skipped.
  const handleSelectMedicineTemplate = (template: MedicineTemplate) => {
    setMedicines((prev) => {
      const seen = new Set(prev.map((m) => m.name.trim().toLowerCase()))
      const added = template.items
        .filter((i) => i.medicine.trim() && !seen.has(i.medicine.trim().toLowerCase()))
        .map((i) => ({ name: i.medicine, dosage: "", frequency: i.frequency, duration: i.duration }))
      if (added.length === 0) toast.info("Those medicines are already on the list")
      return [...prev, ...added]
    })
    setShowMedicineSelector(false)
  }

  const updateMedicine = (index: number, patch: Partial<QuickRxMedicine>) => {
    setMedicines((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const handleSave = async () => {
    if (diagnoses.length === 0 && medicines.length === 0) {
      toast.error("Add at least one diagnosis or medicine")
      return
    }
    if (diagnoses.some((d) => !d.diagnosisText.trim())) {
      toast.error("Diagnosis text cannot be empty")
      return
    }
    if (medicines.some((m) => !m.name.trim())) {
      toast.error("Medicine name cannot be empty")
      return
    }

    setSaving(true)
    try {
      const result = await saveQuickRxAction(visitId, {
        diagnoses: diagnoses.map((d) => ({
          diagnosisId: d.diagnosisId,
          diagnosisText: d.diagnosisText,
          toothNumbers: d.toothNumbers,
        })),
        medicines,
      })

      if (result.success && result.prescriptionId) {
        toast.success("Prescription saved")
        onSuccess?.(result.prescriptionId)
        onClose()
      } else {
        toast.error(result.error || "Failed to save prescription")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quick Rx</DialogTitle>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Saves onto this visit&apos;s prescription — open the full form afterwards to add
              complaint, advice or follow-up.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[60vh] overflow-y-auto pr-1">
            {/* Diagnoses */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                <Stethoscope className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                Diagnoses ({diagnoses.length})
              </div>

              {diagnoses.length === 0 ? (
                <p className="text-xs py-6 text-center rounded-md" style={{ color: BRAND_COLORS.borderDivider, backgroundColor: BRAND_COLORS.lightBackground }}>
                  No diagnoses yet
                </p>
              ) : (
                diagnoses.map((dx, idx) => (
                  <div key={idx} className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: "#E0E3E5" }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
                        {dx.specialty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDiagnoses((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500"
                        aria-label="Remove diagnosis"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      value={dx.diagnosisText}
                      onChange={(e) => updateDiagnosis(idx, { diagnosisText: e.target.value })}
                      rows={2}
                      className="w-full text-xs border rounded p-2 resize-none"
                      placeholder="Diagnosis (editable for this visit)"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      {dx.toothNumbers.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                      <button
                        type="button"
                        onClick={() => setToothEditIndex(idx)}
                        className="text-xs font-medium hover:underline"
                        style={{ color: BRAND_COLORS.primaryTeal }}
                      >
                        {dx.toothNumbers.length > 0 ? "Edit teeth" : "+ Select teeth"}
                      </button>
                    </div>
                  </div>
                ))
              )}

              <Button type="button" variant="outline" size="sm" onClick={() => setShowDiagnosisPicker(true)} className="w-full text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Diagnosis
              </Button>
            </section>

            {/* Medicines */}
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                <Pill className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                Medicines ({medicines.length})
              </div>

              {medicines.length === 0 ? (
                <p className="text-xs py-6 text-center rounded-md" style={{ color: BRAND_COLORS.borderDivider, backgroundColor: BRAND_COLORS.lightBackground }}>
                  No medicines yet
                </p>
              ) : (
                medicines.map((med, idx) => (
                  <div key={idx} className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: "#E0E3E5" }}>
                    <div className="flex items-start gap-2">
                      <input
                        value={med.name}
                        onChange={(e) => updateMedicine(idx, { name: e.target.value })}
                        className="flex-1 min-w-0 text-xs border rounded p-1.5 font-medium"
                        placeholder="Medicine name"
                      />
                      <button
                        type="button"
                        onClick={() => setMedicines((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 mt-1.5"
                        aria-label="Remove medicine"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        value={med.dosage}
                        onChange={(e) => updateMedicine(idx, { dosage: e.target.value })}
                        className="text-xs border rounded p-1.5"
                        placeholder="Dosage"
                      />
                      <input
                        value={med.frequency}
                        onChange={(e) => updateMedicine(idx, { frequency: e.target.value })}
                        className="text-xs border rounded p-1.5"
                        placeholder="1-0-1"
                      />
                      <input
                        value={med.duration}
                        onChange={(e) => updateMedicine(idx, { duration: e.target.value })}
                        className="text-xs border rounded p-1.5"
                        placeholder="5 days"
                      />
                    </div>
                  </div>
                ))
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowMedicineSelector(true)} className="flex-1 text-xs">
                  Template
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowMedicinePicker(true)} className="flex-1 text-xs">
                  Choose
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMedicines((prev) => [...prev, { name: "", dosage: "", frequency: "", duration: "" }])}
                  className="flex-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Blank
                </Button>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Prescription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDiagnosisPicker && (
        <LibraryPickerDialog
          title="Diagnosis"
          endpoint="/api/clinical-library?section=DIAGNOSIS"
          chosen={diagnoses.map((d) => d.diagnosisText)}
          onPick={handleAddDiagnosis}
          onCreate={handleCreateDiagnosis}
          createHint="Pick several, then set teeth for each below."
          onClose={() => setShowDiagnosisPicker(false)}
        />
      )}

      {showMedicinePicker && (
        <LibraryPickerDialog
          title="Medicines"
          endpoint="/api/medicines"
          chosen={medicines.map((m) => m.name)}
          onPick={handlePickMedicine}
          onClose={() => setShowMedicinePicker(false)}
        />
      )}

      {toothEditIndex !== null && diagnoses[toothEditIndex] && (
        <ToothSelectorDialog
          selected={diagnoses[toothEditIndex].toothNumbers}
          onSelect={handleSelectTeeth}
          onClose={() => setToothEditIndex(null)}
        />
      )}

      {showMedicineSelector && (
        <MedicineTemplateSelector
          onSelect={handleSelectMedicineTemplate}
          onClose={() => setShowMedicineSelector(false)}
        />
      )}
    </>
  )
}
