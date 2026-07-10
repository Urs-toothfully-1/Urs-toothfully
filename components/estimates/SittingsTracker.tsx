"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateItemSittingsAction } from "@/actions/estimates"
import { BRAND_COLORS } from "@/lib/constants"
import { Minus, Plus, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export interface SittingItem {
  id: string
  treatmentName: string
  toothNumber?: string | null
  plannedSittings: number
  completedSittings: number
  status: string
}

interface Props {
  patientId: string
  items: SittingItem[]
}

function deriveStatus(completed: number, planned: number): string {
  if (completed <= 0) return "PENDING"
  if (completed >= planned) return "COMPLETED"
  return "IN_PROGRESS"
}

export function SittingsTracker({ patientId, items: initialItems }: Props) {
  const [items, setItems] = useState<SittingItem[]>(initialItems)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [, startSaving] = useTransition()
  const router = useRouter()

  function persist(id: string, patch: { plannedSittings?: number; completedSittings?: number; status?: string }) {
    setSavingId(id)
    startSaving(async () => {
      const result = await updateItemSittingsAction(id, patientId, patch)
      setSavingId(null)
      if (!result.success) {
        toast.error(result.error ?? "Failed to update sittings")
      } else {
        router.refresh()
      }
    })
  }

  function changeCompleted(item: SittingItem, delta: number) {
    const completed = Math.max(0, Math.min(item.plannedSittings, item.completedSittings + delta))
    if (completed === item.completedSittings) return
    const status = deriveStatus(completed, item.plannedSittings)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completedSittings: completed, status } : i)))
    persist(item.id, { completedSittings: completed, status })
  }

  function changePlanned(item: SittingItem, value: number) {
    const planned = Math.max(1, value || 1)
    const completed = Math.min(item.completedSittings, planned)
    const status = deriveStatus(completed, planned)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, plannedSittings: planned, completedSittings: completed, status } : i)))
    persist(item.id, { plannedSittings: planned, completedSittings: completed, status })
  }

  function markAllDone(item: SittingItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completedSittings: i.plannedSittings, status: "COMPLETED" } : i)))
    persist(item.id, { completedSittings: item.plannedSittings, status: "COMPLETED" })
  }

  if (items.length === 0) {
    return <p className="text-sm text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>No treatments to track.</p>
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        Record how many sittings you completed today. Adjust the total plan if the treatment needs more or fewer sittings —
        it updates instantly and is visible to reception.
      </p>
      {items.map((item) => {
        const done = item.completedSittings >= item.plannedSittings
        const pct = Math.min(100, Math.round((item.completedSittings / item.plannedSittings) * 100))
        return (
          <div
            key={item.id}
            className="rounded-lg border p-3 flex items-center gap-4 flex-wrap"
            style={{ borderColor: BRAND_COLORS.lightBackground, backgroundColor: done ? "#F0FDF4" : "white" }}
          >
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                {item.treatmentName}
                {item.toothNumber && (
                  <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}>
                    {item.toothNumber}
                  </span>
                )}
              </p>
              <div className="mt-1.5 w-40 h-1.5 rounded-full" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: done ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.primaryTeal }} />
              </div>
            </div>

            {/* Completed controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Done today &amp; total</span>
              <button type="button" onClick={() => changeCompleted(item, -1)}
                disabled={item.completedSittings <= 0}
                className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50"
                style={{ borderColor: BRAND_COLORS.lightBackground }}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm font-bold tabular-nums w-14 text-center"
                style={{ color: done ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.bodyText }}>
                {item.completedSittings} / {item.plannedSittings}
              </span>
              <button type="button" onClick={() => changeCompleted(item, +1)}
                disabled={item.completedSittings >= item.plannedSittings}
                className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50"
                style={{ borderColor: BRAND_COLORS.lightBackground }}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Planned editor */}
            <label className="flex items-center gap-1.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Plan
              <input
                type="number"
                min={1}
                value={item.plannedSittings}
                onChange={(e) => changePlanned(item, parseInt(e.target.value))}
                className="h-7 w-14 rounded border px-1.5 text-sm text-center"
                style={{ borderColor: BRAND_COLORS.lightBackground }}
              />
            </label>

            {/* Mark done + saving indicator */}
            <div className="flex items-center gap-2">
              {savingId === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND_COLORS.borderDivider }} />
              ) : done ? (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>
                  <CheckCircle2 className="h-4 w-4" /> Done
                </span>
              ) : (
                <button type="button" onClick={() => markAllDone(item)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md text-white"
                  style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}>
                  Mark all done
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
