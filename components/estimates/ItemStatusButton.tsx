"use client"

import { useTransition } from "react"
import { updateItemStatusAction } from "@/actions/estimates"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  itemId: string
  estimateId: string
  patientId: string
  currentStatus: string
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string; bg: string } | null> = {
  PENDING: { next: "IN_PROGRESS", label: "Start", color: "#1D4ED8", bg: "#DBEAFE" },
  IN_PROGRESS: { next: "COMPLETED", label: "Complete", color: "#065F46", bg: "#D1FAE5" },
  COMPLETED: null,
  CANCELLED: null,
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  IN_PROGRESS: { label: "In Progress", color: "#1D4ED8", bg: "#DBEAFE" },
  COMPLETED: { label: "Completed", color: "#065F46", bg: "#D1FAE5" },
  CANCELLED: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
}

export function ItemStatusButton({ itemId, estimateId, patientId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition()
  const next = STATUS_FLOW[currentStatus]
  const badge = STATUS_BADGE[currentStatus]

  function handleUpdate() {
    if (!next) return
    startTransition(async () => {
      const result = await updateItemStatusAction(itemId, estimateId, patientId, next.next)
      if (!result.success) toast.error(result.error ?? "Failed to update")
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-xs px-2 py-0.5 rounded font-semibold"
        style={{ backgroundColor: badge?.bg, color: badge?.color }}
      >
        {badge?.label ?? currentStatus}
      </span>
      {next && (
        <button
          onClick={handleUpdate}
          disabled={isPending}
          className="text-xs px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: next.bg, color: next.color }}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            next.label
          )}
        </button>
      )}
    </div>
  )
}
