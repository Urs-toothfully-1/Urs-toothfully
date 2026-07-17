/** Light, easy-to-tell-apart colour per branch (matched by name substring). */
export interface BranchColor {
  bg: string
  text: string
  dot: string
}

const OUTRAM: BranchColor = { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" } // light blue
const ALIPORE: BranchColor = { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E" } // light green
const SALTLAKE: BranchColor = { bg: "#F3E8FF", text: "#7E22CE", dot: "#A855F7" } // light purple
const FALLBACK: BranchColor = { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" } // light amber

export function branchColor(name?: string | null): BranchColor {
  const n = (name ?? "").toLowerCase()
  if (n.includes("outram")) return OUTRAM
  if (n.includes("alipore")) return ALIPORE
  if (n.includes("salt")) return SALTLAKE
  return FALLBACK
}
