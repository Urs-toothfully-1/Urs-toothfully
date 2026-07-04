"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { addToQueueAction, AddToQueueState } from "@/actions/queue"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, PlusCircle, CheckCircle2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { useEffect } from "react"

interface Doctor {
  id: string
  name: string
  doctorRegNo: string | null
  branch?: { name: string }
}

interface Props {
  patientId: string
  patientName: string
  branchName: string
  doctors: Doctor[]
  assignmentMode: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-10 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding to Queue…</>
      ) : (
        <><PlusCircle className="mr-2 h-4 w-4" />Add to Queue</>
      )}
    </Button>
  )
}

const VISIT_TYPES = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "TREATMENT_SESSION", label: "Treatment Session" },
  { value: "FOLLOW_UP", label: "Follow-Up" },
  { value: "EMERGENCY_VISIT", label: "Emergency" },
  { value: "REVIEW", label: "Review" },
]

const selectClass =
  "w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"

export function AddToQueueDialog({
  patientId,
  patientName,
  branchName,
  doctors,
  assignmentMode,
}: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(addToQueueAction, {} as AddToQueueState)

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        window.location.href = "/reception"
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [state])

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="font-semibold text-white"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Add to Queue
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !state.success && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
            {/* Top bar */}
            <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />

            <div className="px-6 py-5">
              <h2 className="text-base font-bold mb-0.5" style={{ color: BRAND_COLORS.bodyText }}>
                Add to Queue
              </h2>
              <p className="text-sm mb-5" style={{ color: BRAND_COLORS.borderDivider }}>
                {patientName} · {branchName} Branch
              </p>

              {state.success ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-10 w-10" style={{ color: BRAND_COLORS.secondaryGreen }} />
                  <p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                    Added to queue!
                  </p>
                  <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                    Redirecting to reception…
                  </p>
                </div>
              ) : (
                <form action={formAction} className="space-y-4">
                  <input type="hidden" name="patientId" value={patientId} />

                  {state.error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{state.error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Visit Type */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      Visit Type <span className="text-red-500">*</span>
                    </Label>
                    <select name="visitType" required className={selectClass}>
                      {VISIT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Doctor Assignment */}
                  {assignmentMode === "SPECIFIC_DOCTOR" ? (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                        Assign Doctor <span className="text-red-500">*</span>
                      </Label>
                      <select name="doctorId" required className={selectClass}>
                        <option value="">Select doctor…</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.branch ? ` — ${d.branch.name}` : ""}
                            {d.doctorRegNo ? ` (${d.doctorRegNo})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm rounded-md p-3" style={{ backgroundColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.borderDivider }}>
                      Next Available Mode — doctor will claim this patient from their queue.
                    </p>
                  )}

                  {/* Chief Complaint */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      Chief Complaint
                    </Label>
                    <Textarea
                      name="chiefComplaint"
                      placeholder="Patient's main complaint (optional)"
                      className="border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6] resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-[#E0E3E5]"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <div className="flex-1">
                      <SubmitButton />
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
