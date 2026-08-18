"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { CalendarRange, X } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"

/** Quick ranges, counted back from today. `days: null` clears the filter. */
const PRESETS: { label: string; days: number | null }[] = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All time", days: null },
]

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function PatientDateFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter()
  const params = useSearchParams()

  /** Rewrites the range in the URL and resets to page 1 — a filtered list has
   *  different pages, so keeping the old page number would land on a blank one. */
  function apply(next: { from?: string; to?: string }) {
    const qs = new URLSearchParams(params.toString())
    for (const key of ["from", "to"] as const) {
      const value = next[key]
      if (value) qs.set(key, value)
      else qs.delete(key)
    }
    qs.delete("page")
    router.push(`/patients?${qs.toString()}`)
  }

  function applyPreset(days: number | null) {
    if (days === null) return apply({})
    const start = new Date()
    start.setDate(start.getDate() - days)
    apply({ from: isoDate(start), to: isoDate(new Date()) })
  }

  const active = !!(from || to)

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border p-2.5 bg-white" style={{ borderColor: "#E0E3E5" }}>
      <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
        <CalendarRange className="h-3.5 w-3.5" />
        Registered
      </span>

      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p.days)}
          className="text-xs px-2 py-1 rounded-full border hover:bg-slate-50"
          style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }}
        >
          {p.label}
        </button>
      ))}

      <span className="mx-1 h-4 w-px" style={{ backgroundColor: "#E0E3E5" }} />

      <input
        type="date"
        value={from ?? ""}
        max={to || undefined}
        onChange={(e) => apply({ from: e.target.value, to })}
        className="text-xs border rounded px-2 h-8"
        style={{ borderColor: "#E0E3E5" }}
        aria-label="Registered from"
      />
      <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>to</span>
      <input
        type="date"
        value={to ?? ""}
        min={from || undefined}
        onChange={(e) => apply({ from, to: e.target.value })}
        className="text-xs border rounded px-2 h-8"
        style={{ borderColor: "#E0E3E5" }}
        aria-label="Registered to"
      />

      {active && (
        <button
          type="button"
          onClick={() => apply({})}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-slate-50"
          style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.borderDivider }}
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}
