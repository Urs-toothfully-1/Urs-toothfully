"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { saveDentalHistoryAction, DentalHistoryFormState } from "@/actions/dental-history"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { DentalHistoryFields } from "./DentalHistoryFields"
import type { DentalHistory } from "@prisma/client"

interface Props {
  patientId: string
  existing: DentalHistory | null
  isUpdate: boolean
}

function SubmitButton({ isUpdate }: { isUpdate: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 px-8 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isUpdate ? "Updating…" : "Saving…"}</>
      ) : (
        isUpdate ? "Update Dental History" : "Save Dental History"
      )}
    </Button>
  )
}

export function DentalHistoryForm({ patientId, existing, isUpdate }: Props) {
  const boundAction = saveDentalHistoryAction.bind(null, patientId)
  const [state, formAction] = useActionState(boundAction, {} as DentalHistoryFormState)

  return (
    <form action={formAction} className="space-y-6">
      {/* Status messages */}
      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Dental history saved successfully.</AlertDescription>
        </Alert>
      )}

      {isUpdate && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Updating will create a new version. Previous version will be preserved in history.
          </AlertDescription>
        </Alert>
      )}

      <DentalHistoryFields existing={existing} />

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <SubmitButton isUpdate={isUpdate} />
        {isUpdate && (
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            This will create Version {(existing?.version ?? 0) + 1}
          </p>
        )}
      </div>
    </form>
  )
}
