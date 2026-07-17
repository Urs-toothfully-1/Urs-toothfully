const UPPER = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
const LOWER = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]

/**
 * Human, layout-safe label for a comma-separated FDI tooth string.
 * Collapses full arches / whole mouth to a word and caps long lists so the
 * value never overflows a cell or print line. Returns "" for empty input.
 */
export function toothLabel(value?: string | null): string {
  if (!value) return ""
  const teeth = value.split(",").map((t) => t.trim()).filter(Boolean)
  if (teeth.length === 0) return ""
  const set = new Set(teeth)
  const hasUpper = UPPER.every((t) => set.has(t))
  const hasLower = LOWER.every((t) => set.has(t))
  if (hasUpper && hasLower) return "All teeth"
  if (hasUpper) return "All upper teeth"
  if (hasLower) return "All lower teeth"
  if (teeth.length > 6) return `${teeth.length} teeth`
  return `${teeth.length > 1 ? "Teeth" : "Tooth"} ${teeth.join(", ")}`
}
