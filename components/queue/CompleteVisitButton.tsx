"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateQueueStatusAction } from "@/actions/queue"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  queueId: string
}

/**
 * Shown at the bottom of the estimate page while the patient is still
 * WITH_DOCTOR. One click marks the consultation done (ESTIMATE_CREATED)
 * so reception can collect payment, then returns the doctor to their queue.
 */
export function CompleteVisitButton({ queueId }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDone() {
    startTransition(async () => {
      const result = await updateQueueStatusAction(queueId, "ESTIMATE_CREATED")
      if (!result.success) {
        toast.error(result.error ?? "Failed to complete the visit.")
        return
      }
      toast.success("Done — patient sent to reception for payment.")
      router.push("/doctor")
    })
  }

  return (
    <div
      className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{ borderColor: "#A7F3D0", backgroundColor: "#F0FDF9" }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: "#065F46" }}>
          Finished with this patient?
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#047857" }}>
          Estimate, prescription and payment agreement are saved. Click Done to
          send the patient to reception for payment.
        </p>
      </div>
      <button
        onClick={handleDone}
        disabled={isPending}
        className="flex items-center justify-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-lg transition-all flex-shrink-0 disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#047857,#059669)", boxShadow: "0 2px 8px rgba(5,150,105,0.3)" }}
      >
        {isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Completing…</>
        ) : (
          <><CheckCircle2 className="h-4 w-4" />Done — Send to Reception</>
        )}
      </button>
    </div>
  )
}
