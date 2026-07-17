import { branchColor } from "@/lib/branch-colors"

interface Props {
  name?: string | null
  /** "chip" = coloured pill (default); "dot" = small dot + plain text */
  variant?: "chip" | "dot"
  className?: string
}

/** Shows a branch name with its light identifying colour. */
export function BranchBadge({ name, variant = "chip", className = "" }: Props) {
  if (!name) return null
  const c = branchColor(name)
  if (variant === "dot") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
        {name}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {name}
    </span>
  )
}
