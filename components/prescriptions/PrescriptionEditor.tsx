"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { updatePrescriptionAction, PrescriptionFormState } from "@/actions/prescriptions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import type { PrescriptionData, PrescriptionMedicine } from "@/lib/prescription-types"

interface Props {
  prescriptionId: string
  data: PrescriptionData
  canEdit: boolean
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
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
      ) : (
        "Save Prescription"
      )}
    </Button>
  )
}

const emptyMedicine: PrescriptionMedicine = {
  name: "", dosage: "", frequency: "", duration: "", instructions: "",
}

const cellCls = "h-9 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white"

export function PrescriptionEditor({ prescriptionId, data, canEdit }: Props) {
  const boundAction = updatePrescriptionAction.bind(null, prescriptionId)
  const [state, formAction] = useActionState(boundAction, {} as PrescriptionFormState)

  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>(
    data.medicines.length > 0 ? data.medicines : [{ ...emptyMedicine }]
  )
  const [advice, setAdvice] = useState(data.advice ?? "")
  const [followUpDate, setFollowUpDate] = useState(data.followUpDate ?? "")

  function setMed(idx: number, key: keyof PrescriptionMedicine, value: string) {
    setMedicines((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  }

  const payload = JSON.stringify({
    medicines: medicines.filter((m) => m.name.trim().length > 0),
    advice,
    followUpDate: followUpDate || undefined,
  })

  if (!canEdit) return null

  return (
    <form action={formAction} className="space-y-5">
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

      {/* ── Medicines ─────────────────────────────────────── */}
      <div className="space-y-2">
        <h3
          className="text-xs font-bold uppercase tracking-wider py-2 px-3 rounded"
          style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
        >
          ℞ Medicines
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions", ""].map((h) => (
                  <th key={h} className="text-left py-1.5 px-1.5 text-xs font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medicines.map((m, idx) => (
                <tr key={idx}>
                  <td className="py-1 px-1.5 min-w-[160px]">
                    <Input value={m.name} onChange={(e) => setMed(idx, "name", e.target.value)} placeholder="e.g. Amoxicillin 500mg" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[90px]">
                    <Input value={m.dosage} onChange={(e) => setMed(idx, "dosage", e.target.value)} placeholder="1 tab" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[110px]">
                    <Input value={m.frequency} onChange={(e) => setMed(idx, "frequency", e.target.value)} placeholder="1-0-1" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[90px]">
                    <Input value={m.duration} onChange={(e) => setMed(idx, "duration", e.target.value)} placeholder="5 days" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5 min-w-[140px]">
                    <Input value={m.instructions ?? ""} onChange={(e) => setMed(idx, "instructions", e.target.value)} placeholder="After food" className={cellCls} />
                  </td>
                  <td className="py-1 px-1.5">
                    <button
                      type="button"
                      onClick={() => setMedicines((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      aria-label="Remove medicine"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() => setMedicines((prev) => [...prev, { ...emptyMedicine }])}
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          <Plus className="h-4 w-4" />
          Add medicine
        </button>
      </div>

      {/* ── Advice + follow-up ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Advice / Instructions
          </label>
          <Textarea
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="Post-treatment care, diet advice, warnings…"
            rows={3}
            className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Next Visit / Follow-up
          </label>
          <Input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="h-10 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <SubmitButton />
      </div>
    </form>
  )
}
