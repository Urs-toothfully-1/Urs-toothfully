"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { createClinicalNoteAction, NoteFormState } from "@/actions/clinical-notes"
import { ToothSelector } from "@/components/dental/ToothSelector"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2, PenLine } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { NOTE_TYPE_LABELS } from "@/lib/queue-helpers"

interface Visit {
  id: string
  visitNo: string
}

interface Props {
  patientId: string
  visits: Visit[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-9 px-5 text-sm font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
      ) : (
        <><PenLine className="mr-2 h-3.5 w-3.5" />Save Note</>
      )}
    </Button>
  )
}

const selectClass =
  "w-full h-9 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"

export function NewNoteForm({ patientId, visits }: Props) {
  const boundAction = createClinicalNoteAction.bind(null, patientId)
  const [state, formAction] = useActionState(boundAction, {} as NoteFormState)
  const [teeth, setTeeth] = useState("")

  return (
    <form action={formAction} className="space-y-3 p-4 bg-white rounded-lg border border-[#E0E3E5]">
      <input type="hidden" name="toothNumbers" value={teeth} />
      <h3 className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
        New Clinical Note
      </h3>

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50 py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{state.error}</AlertDescription>
        </Alert>
      )}
      {state.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800 py-2">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-sm">Note saved.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-3">
        {/* Visit */}
        <div className="space-y-1">
          <Label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Visit <span className="text-red-500">*</span>
          </Label>
          <select name="visitId" required className={selectClass}>
            <option value="">Select visit…</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.visitNo}
              </option>
            ))}
          </select>
        </div>

        {/* Note Type */}
        <div className="space-y-1">
          <Label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Note Type
          </Label>
          <select name="noteType" className={selectClass}>
            {Object.entries(NOTE_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Tooth / teeth this note refers to */}
        <div className="space-y-1">
          <Label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Tooth / Teeth
          </Label>
          <ToothSelector value={teeth} onChange={setTeeth} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <Label className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Note <span className="text-red-500">*</span>
        </Label>
        <Textarea
          name="content"
          required
          placeholder="Enter clinical observations, diagnosis, treatment notes…"
          className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6] resize-none"
          rows={4}
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          Notes are immutable after saving.
        </p>
      </div>
    </form>
  )
}
