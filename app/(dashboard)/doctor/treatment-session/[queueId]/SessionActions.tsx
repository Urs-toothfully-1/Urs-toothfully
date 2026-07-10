"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Stethoscope, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/shared/BackButton"
import { BRAND_COLORS } from "@/lib/constants"
import { updateQueueStatusAction, completeTreatmentSessionAction } from "@/actions/queue"
import { toast } from "sonner"

interface TreatmentItem {
  id: string
  treatmentName: string
  toothNumber?: string | null
  quantity: number
  unitRate: number
  amount: number
  status: string
}

interface Props {
  queueId: string
  patientId: string
  status: string
  items: TreatmentItem[]
}

export function SessionActions({ queueId, patientId, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleBegin() {
    startTransition(async () => {
      const result = await updateQueueStatusAction(queueId, "WITH_DOCTOR")
      if (result.success) {
        toast.success("Session started")
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to start session")
      }
    })
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTreatmentSessionAction({ queueId, patientId })
      if (result.success) {
        toast.success("Session ended — treatments with remaining sittings stay open")
        router.push("/doctor")
      } else {
        toast.error(result.error ?? "Failed to complete session")
      }
    })
  }

  if (status === "WAITING") {
    return (
      <div className="flex items-center gap-3">
        <Button
          onClick={handleBegin}
          disabled={isPending}
          className="flex items-center gap-2 font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#005E97,#0077BE)" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          Begin Session
        </Button>
        <BackButton fallbackHref="/doctor" />
        <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          Patient is waiting — begin to start treatment
        </span>
      </div>
    )
  }

  if (status === "WITH_DOCTOR") {
    return (
      <div className="space-y-3">
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          Record the sittings you did today in the <strong>Sittings Done Today</strong> section above.
          Completing the session ends today&apos;s visit — treatments that still have sittings left stay open,
          so the patient can be booked for another session.
        </p>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleComplete}
            disabled={isPending}
            className="flex items-center gap-2 font-semibold text-white"
            style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" />Complete Session</>
            )}
          </Button>
          <BackButton fallbackHref="/doctor" label="Back without completing" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-lg"
      style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}
    >
      <CheckCircle2 className="h-4 w-4" />
      <span className="text-sm font-semibold">Session completed</span>
    </div>
  )
}
