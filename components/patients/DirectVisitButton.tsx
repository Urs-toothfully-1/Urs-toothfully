"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FilePlus2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { startDirectVisitAction } from "@/actions/visits"

/**
 * Patient overview → start a prescription / estimate without the queue.
 * The chosen doctor's name goes on the prescription; the visit records who
 * created it (shown on the Visits tab and in the audit log).
 */
export function DirectVisitButton({
  patientId,
  doctors,
}: {
  patientId: string
  doctors: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [doctorId, setDoctorId] = useState(doctors.length === 1 ? doctors[0].id : "")
  const [complaint, setComplaint] = useState("")
  const [pending, start] = useTransition()

  function go() {
    start(async () => {
      const res = await startDirectVisitAction(patientId, doctorId, complaint)
      if ("error" in res && res.error) return void toast.error(res.error)
      if ("visitId" in res) router.push(`/doctor/consultation/${res.visitId}`)
    })
  }

  return (
    <Card className="border-[#E0E3E5] bg-white">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Prescription / estimate without the queue
          </p>
          <p className="text-xs text-gray-500">
            Opens the consultation screen directly. Your name is recorded as the creator.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="shrink-0 gap-1.5 bg-[#005E97] text-white hover:bg-[#00507f]"
        >
          <FilePlus2 className="h-4 w-4" /> New prescription / estimate
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New prescription / estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">
                Doctor (printed on the prescription)
              </span>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                aria-label="Doctor"
              >
                <option value="">Choose a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-700">Chief complaint (optional)</span>
              <input
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                maxLength={500}
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm"
                aria-label="Chief complaint"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={go}
              disabled={!doctorId || pending}
              className="bg-[#005E97] text-white hover:bg-[#00507f]"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
