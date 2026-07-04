"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { submitIntakeDentalHistoryAction, IntakeFormState } from "@/actions/intake"
import { DentalHistoryFields } from "@/components/patients/dental-history/DentalHistoryFields"
import { BRAND_COLORS } from "@/lib/constants"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
      ) : (
        <><CheckCircle2 className="h-4 w-4" />Complete Registration</>
      )}
    </button>
  )
}

interface Props {
  patientId: string
  patientName: string
}

export function IntakeDentalHistoryForm({ patientId, patientName }: Props) {
  const [state, formAction] = useActionState(submitIntakeDentalHistoryAction, {} as IntakeFormState)

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="patientName" value={patientName} />

      {state.error && (
        <div className="flex gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      <DentalHistoryFields existing={null} />

      <SubmitBtn />
    </form>
  )
}
