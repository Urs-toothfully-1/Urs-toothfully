"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { Stethoscope, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export function SessionActions({ queueId, patientId, status, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const actionable = items.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(actionable.map((i) => i.id)))

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    if (selectedIds.size === 0) {
      toast.error("Select at least one treatment to mark done")
      return
    }
    startTransition(async () => {
      const result = await completeTreatmentSessionAction({
        queueId,
        patientId,
        completedItemIds: [...selectedIds],
      })
      if (result.success) {
        toast.success("Session completed — treatment progress updated")
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
        <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          Patient is waiting — begin to start treatment
        </span>
      </div>
    )
  }

  if (status === "WITH_DOCTOR") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E0E3E5] overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "#E0E3E5", backgroundColor: "#F7F9FB" }}>
            <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
              Select treatments completed in this session
            </p>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              Unchecked items remain pending for the next visit
            </p>
          </div>
          <div className="divide-y divide-[#F2F4F6]">
            {actionable.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F7F9FB] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 flex-shrink-0"
                  style={{ accentColor: BRAND_COLORS.secondaryGreen }}
                />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      {item.treatmentName}
                    </p>
                    {item.toothNumber && (
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        Tooth #{item.toothNumber}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: item.status === "PENDING" ? "#FEF3C7" : "#DBEAFE",
                      color: item.status === "PENDING" ? "#B45309" : "#1D4ED8",
                    }}
                  >
                    {item.status === "PENDING" ? "Pending" : "In Progress"}
                  </span>
                </div>
              </label>
            ))}
            {actionable.length === 0 && (
              <p className="px-4 py-4 text-sm text-center" style={{ color: BRAND_COLORS.borderDivider }}>
                All treatments are already completed.
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={handleComplete}
          disabled={isPending || selectedIds.size === 0}
          className="flex items-center gap-2 font-semibold text-white"
          style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" />Complete Session ({selectedIds.size} treatment{selectedIds.size !== 1 ? "s" : ""})</>
          )}
        </Button>
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
