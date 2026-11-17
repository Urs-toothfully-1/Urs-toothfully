"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cancelVisitAction } from "@/actions/visits"

/** Visits tab → cancel a visit (and its estimates). Blocked server-side once money is recorded. */
export function CancelVisitButton({ visitId, visitNo }: { visitId: string; visitNo: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      const res = await cancelVisitAction(visitId, reason)
      if ("error" in res && res.error) return void toast.error(res.error)
      toast.success(`${visitNo} cancelled`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50" aria-label={`Cancel ${visitNo}`}>
        <Ban className="h-3.5 w-3.5" /> Cancel
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel {visitNo}?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">The visit and its estimate are marked cancelled. The prescription stays on record. Not possible once a payment or invoice exists.</p>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-700">Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus
              className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm" aria-label="Reason for cancelling" placeholder="e.g. Created by mistake" />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Keep</Button>
            <Button onClick={confirm} disabled={pending || reason.trim().length < 3} className="bg-red-600 text-white hover:bg-red-700">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
