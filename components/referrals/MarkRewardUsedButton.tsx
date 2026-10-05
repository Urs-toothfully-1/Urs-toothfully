"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { markRewardUsedAction } from "@/actions/referrals"
import { Button } from "@/components/ui/button"

export function MarkRewardUsedButton({ referralId, patientId }: { referralId: string; patientId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function mark() {
    const note = window.prompt("How was the reward used? (e.g. Check-up done on 12 Oct)", "")
    if (note === null) return
    startTransition(async () => {
      const res = await markRewardUsedAction(referralId, note, patientId)
      if (res.success) { toast.success("Reward marked as used"); router.refresh() }
      else toast.error(res.error ?? "Failed")
    })
  }

  return (
    <Button size="sm" variant="outline" className="h-8" onClick={mark} disabled={pending}>
      {pending ? "Saving…" : "Mark used"}
    </Button>
  )
}
