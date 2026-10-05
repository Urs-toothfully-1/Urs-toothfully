"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cancelRewardAction, markRewardUsedAction } from "@/actions/rewards"

/** "Mark used" / "Undo" on an unused reward. Undo returns its points. */
export function RewardRowActions({ id, patientId }: { id: string; patientId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function markUsed() {
    const note = window.prompt("How was the reward used? (e.g. check-up done today)", "")
    if (note === null) return
    start(async () => {
      const res = await markRewardUsedAction(id, note, patientId)
      if (res.success) { toast.success("Marked as used"); router.refresh() } else toast.error(res.error ?? "Failed")
    })
  }
  function undo() {
    if (!window.confirm("Cancel this reward? Its points become available again.")) return
    start(async () => {
      const res = await cancelRewardAction(id, patientId)
      if (res.success) { toast.success("Reward cancelled — points returned"); router.refresh() } else toast.error(res.error ?? "Failed")
    })
  }

  return (
    <span className="inline-flex gap-1.5">
      <button type="button" onClick={markUsed} disabled={pending} className="text-[11px] font-semibold px-2 py-0.5 rounded border hover:bg-gray-50" style={{ borderColor: "#D1D5DB" }}>
        Mark used
      </button>
      <button type="button" onClick={undo} disabled={pending} className="text-[11px] font-semibold px-2 py-0.5 rounded border text-red-600 hover:bg-red-50" style={{ borderColor: "#FECACA" }}>
        Undo
      </button>
    </span>
  )
}
