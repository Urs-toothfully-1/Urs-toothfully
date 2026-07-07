"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BRAND_COLORS } from "@/lib/constants"
import { completeTreatmentSessionAction } from "@/actions/queue"
import { toast } from "sonner"

interface TreatmentItem {
  id: string
  treatmentName: string
  toothNumber?: string | null
  status: string
}

interface Props {
  queueId: string
  patientId: string
  items: TreatmentItem[]
}

export function TreatmentCompletionDialog({ queueId, patientId, items }: Props) {
  const actionableItems = items.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS")
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(actionableItems.map((i) => i.id)))
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleOpen() {
    setSelectedIds(new Set(actionableItems.map((i) => i.id)))
    setOpen(true)
  }

  function handleDone() {
    startTransition(async () => {
      const result = await completeTreatmentSessionAction({
        queueId,
        patientId,
        completedItemIds: [...selectedIds],
      })
      if (result.success) {
        toast.success("Session completed — treatment progress updated")
        setOpen(false)
      } else {
        toast.error(result.error ?? "Failed to complete session")
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg"
        style={{ background: "linear-gradient(135deg,#006B5F,#008F7F)" }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />Done
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setOpen(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl border border-[#E0E3E5] w-full max-w-sm mx-4 overflow-hidden">
            <div className="h-1" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }} />
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
                <h2 className="text-sm font-bold" style={{ color: BRAND_COLORS.bodyText }}>
                  Complete Treatment Session
                </h2>
              </div>
              <p className="text-xs mb-4" style={{ color: BRAND_COLORS.borderDivider }}>
                Select the treatments completed in this session. Unchecked items stay pending for the next visit.
              </p>

              <div className="rounded-lg border border-[#E0E3E5] divide-y divide-[#F2F4F6] mb-5 max-h-56 overflow-y-auto">
                {actionableItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F7F9FB] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4 accent-[#006B5F] flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                        {item.treatmentName}
                      </p>
                      {item.toothNumber && (
                        <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                          Tooth #{item.toothNumber}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
                {actionableItems.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>
                    No pending treatments found.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleDone}
                  disabled={isPending}
                  className="flex-1 h-9 text-sm font-semibold text-white gap-2"
                  style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
                >
                  {isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                    : <><CheckCircle2 className="h-4 w-4" />Mark Done ({selectedIds.size})</>
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
