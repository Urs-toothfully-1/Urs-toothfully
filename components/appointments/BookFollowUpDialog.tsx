"use client"

import { useState, useActionState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createAppointmentAction } from "@/actions/appointments"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { CalendarPlus, Loader2 } from "lucide-react"

interface Props {
  patientId: string
  branchId: string
  patientName?: string
}

/** Doctor books a follow-up for the current patient (doctor = self, on the server). */
export function BookFollowUpDialog({ patientId, branchId, patientName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Side effects live in the action, not an effect: they belong to the submit
  // event, and reacting to `state` re-fired the toast whenever the effect's
  // dependencies changed identity.
  const [state, formAction, pending] = useActionState(
    async (prev: { success?: boolean; error?: string }, formData: FormData) => {
      const result = await createAppointmentAction(prev, formData)
      if (result.success) {
        toast.success("Follow-up booked")
        setOpen(false)
        router.refresh()
      } else if (result.error) {
        toast.error(result.error)
      }
      return result
    },
    {} as { success?: boolean; error?: string }
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
        style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
      >
        <CalendarPlus className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
        Book Follow-up
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Book Follow-up</DialogTitle>
            <DialogDescription>{patientName ?? "This patient"} · with you</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="branchId" value={branchId} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" name="date" min={new Date().toISOString().slice(0, 10)} required />
              <Input type="time" name="time" required />
            </div>
            <Input name="reason" placeholder="Reason (optional)" maxLength={300} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" disabled={pending} style={{ backgroundColor: BRAND_COLORS.primaryTeal }} className="text-white">
                {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
