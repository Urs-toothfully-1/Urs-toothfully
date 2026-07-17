"use client"

import { useState, useTransition } from "react"
import { Stethoscope, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BRAND_COLORS } from "@/lib/constants"
import { toothLabel } from "@/lib/teeth"
import { startTreatmentSessionAction } from "@/actions/queue"
import { toast } from "sonner"

interface PendingItem {
  id: string
  treatmentName: string
  toothNumber?: string | null
}

interface Doctor {
  id: string
  name: string
}

interface Props {
  pendingItems: PendingItem[]
  patientId: string
  branchId: string
  doctors: Doctor[]
}

export function TreatmentSessionDialog({ pendingItems, patientId, branchId, doctors }: Props) {
  const [open, setOpen] = useState(false)
  const [doctorId, setDoctorId] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setDoctorId("")
    setOpen(true)
  }

  function handleConfirm() {
    if (!doctorId) return
    startTransition(async () => {
      const result = await startTreatmentSessionAction({
        patientId,
        branchId,
        doctorId,
        pendingTreatments: pendingItems.map((i) => i.treatmentName),
      })
      if (result.success) {
        toast.success("Patient sent to doctor's queue for treatment session")
        setOpen(false)
      } else {
        toast.error(result.error ?? "Failed to start session")
      }
    })
  }

  if (pendingItems.length === 0) return null

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold border bg-white transition-colors hover:bg-blue-50"
        style={{ color: "#1D4ED8", borderColor: "#93C5FD" }}
      >
        <Play className="h-3 w-3" />
        Start Session
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setOpen(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl border border-[#E0E3E5] w-full max-w-sm mx-4 overflow-hidden">
            <div className="h-1" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                <h2 className="text-sm font-bold" style={{ color: BRAND_COLORS.bodyText }}>
                  Start Treatment Session
                </h2>
              </div>
              <p className="text-xs mb-4" style={{ color: BRAND_COLORS.borderDivider }}>
                Select a doctor. The doctor will decide which treatments to work on.
              </p>

              {/* Pending treatments — read-only info for receptionist */}
              <p className="text-xs font-semibold mb-1.5" style={{ color: BRAND_COLORS.bodyText }}>
                Pending Treatments ({pendingItems.length})
              </p>
              <div
                className="rounded-lg border border-[#E0E3E5] divide-y divide-[#F2F4F6] mb-4 max-h-40 overflow-y-auto"
                style={{ backgroundColor: BRAND_COLORS.lightBackground }}
              >
                {pendingItems.map((item) => (
                  <div key={item.id} className="px-3 py-2">
                    <p className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      {item.treatmentName}
                    </p>
                    {item.toothNumber && (
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {toothLabel(item.toothNumber)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Doctor select */}
              <label className="block text-xs font-semibold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
                Assign Doctor
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] mb-5"
              >
                <option value="">— Select doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!doctorId || isPending}
                  className="flex-1 h-9 text-sm font-semibold text-white gap-2"
                  style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
                >
                  {isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                    : <><Stethoscope className="h-4 w-4" />Send to Queue</>
                  }
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="h-9 px-4 text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
