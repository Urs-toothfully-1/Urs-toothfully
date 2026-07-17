"use client"

import { useState } from "react"
import { BRAND_COLORS } from "@/lib/constants"
import { toothLabel } from "@/lib/teeth"
import { X } from "lucide-react"

/**
 * FDI-notation tooth picker — quadrant grid with single/multi select,
 * optional primary (deciduous) teeth and "Select All". Value is a
 * comma-separated string of tooth numbers, e.g. "16,15,46".
 */

const PERMANENT: { label: string; teeth: number[] }[][] = [
  [
    { label: "Upper Right (1)", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
    { label: "Upper Left (2)", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  ],
  [
    { label: "Lower Right (4)", teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
    { label: "Lower Left (3)", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
  ],
]

const PRIMARY: { label: string; teeth: number[] }[][] = [
  [
    { label: "Upper Right (5)", teeth: [55, 54, 53, 52, 51] },
    { label: "Upper Left (6)", teeth: [61, 62, 63, 64, 65] },
  ],
  [
    { label: "Lower Right (8)", teeth: [85, 84, 83, 82, 81] },
    { label: "Lower Left (7)", teeth: [71, 72, 73, 74, 75] },
  ],
]

interface Props {
  /** comma-separated tooth numbers */
  value: string
  onChange: (value: string) => void
  /** compact trigger for table cells */
  compact?: boolean
}

function parseValue(value: string): Set<string> {
  return new Set(
    value.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
  )
}

export function ToothSelector({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => parseValue(value))
  const [showPrimary, setShowPrimary] = useState(false)

  const display = toothLabel(value)

  function openDialog() {
    setSelected(parseValue(value))
    setOpen(true)
  }

  function toggle(tooth: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      const key = String(tooth)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    const all = PERMANENT.flat().flatMap((q) => q.teeth).map(String)
    setSelected((prev) => (prev.size === all.length ? new Set() : new Set(all)))
  }

  function commit() {
    // Keep a stable, readable order: quadrant order as laid out above
    const order = [...PERMANENT.flat(), ...PRIMARY.flat()].flatMap((q) => q.teeth).map(String)
    const sorted = order.filter((t) => selected.has(t))
    onChange(sorted.join(","))
    setOpen(false)
  }

  const quadrantRows = showPrimary ? [...PERMANENT, ...PRIMARY] : PERMANENT

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={`w-full rounded border text-left transition-colors hover:border-[#0077BE] ${
          compact ? "h-8 px-2 text-sm" : "h-9 px-3 text-sm"
        }`}
        style={{
          borderColor: "#E0E3E5",
          backgroundColor: "#F2F4F6",
          color: display ? BRAND_COLORS.bodyText : "#9AA1A9",
        }}
      >
        {display || "Tooth…"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                Select Tooth / Teeth
              </h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
              </button>
            </div>

            {/* Options row */}
            <div className="flex items-center gap-5 mb-4 text-sm" style={{ color: BRAND_COLORS.bodyText }}>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrimary}
                  onChange={(e) => setShowPrimary(e.target.checked)}
                  className="accent-[#005E97]"
                />
                Show primary teeth
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size >= 32}
                  onChange={selectAll}
                  className="accent-[#005E97]"
                />
                Select all teeth
              </label>
            </div>

            {/* Quadrant grid */}
            <div className="space-y-3">
              {quadrantRows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  {row.map((q) => (
                    <div
                      key={q.label}
                      className="rounded-lg border p-2.5"
                      style={{ borderColor: "#E0E3E5" }}
                    >
                      <p className="text-xs font-medium mb-1.5" style={{ color: BRAND_COLORS.borderDivider }}>
                        {q.label}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {q.teeth.map((t) => {
                          const active = selected.has(String(t))
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => toggle(t)}
                              className="h-8 w-8 rounded-md text-xs font-semibold transition-colors"
                              style={{
                                backgroundColor: active ? BRAND_COLORS.primaryTeal : "#F2F4F6",
                                color: active ? "#FFFFFF" : BRAND_COLORS.bodyText,
                                border: `1px solid ${active ? BRAND_COLORS.primaryTeal : "#E0E3E5"}`,
                              }}
                            >
                              {t}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm"
                style={{ color: BRAND_COLORS.borderDivider }}
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 px-4 rounded-md text-sm font-medium border"
                  style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  className="h-9 px-6 rounded-md text-sm font-semibold text-white"
                  style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
                >
                  Add{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
