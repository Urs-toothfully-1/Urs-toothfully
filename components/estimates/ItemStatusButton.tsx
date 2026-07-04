"use client"

import { useTransition } from "react"
import { updateItemStatusAction } from "@/actions/estimates"
import { Loader2, Play, Check } from "lucide-react"
import { toast } from "sonner"

interface Props {
  itemId: string
  estimateId: string
  patientId: string
  currentStatus: string
}

const STATUS_FLOW: Record<string, { next: string; label: string; icon: "play" | "check"; color: string; border: string } | null> = {
  PENDING: { next: "IN_PROGRESS", label: "Start", icon: "play", color: "#1D4ED8", border: "#93C5FD" },
  IN_PROGRESS: { next: "COMPLETED", label: "Mark Complete", icon: "check", color: "#065F46", border: "#6EE7B7" },
  COMPLETED: null,
  CANCELLED: null,
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  IN_PROGRESS: { label: "In Progress", color: "#1D4ED8", bg: "#DBEAFE" },
  COMPLETED: { label: "✓ Completed", color: "#065F46", bg: "#D1FAE5" },
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
      else toast.success(next.next === "IN_PROGRESS" ? "Treatment started" : "Treatment completed")
    })
  }

  const Icon = next?.icon === "play" ? Play : Check

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
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium border bg-white transition-colors hover:bg-slate-50 disabled:opacity-60"
          style={{ color: next.color, borderColor: next.border }}
          title={next.next === "IN_PROGRESS" ? "Mark this treatment as started" : "Mark this treatment as completed"}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <><Icon className="h-3 w-3" />{next.label}</>
          )}
        </button>
      )}
    </div>
  )
}
