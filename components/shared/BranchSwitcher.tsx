"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { switchActiveBranchAction } from "@/actions/branch"
import { BRAND_COLORS } from "@/lib/constants"
import { branchColor } from "@/lib/branch-colors"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface BranchOption {
  id: string
  name: string
}

interface Props {
  currentBranchId: string
  branches: BranchOption[]
}

export function BranchSwitcher({ currentBranchId, branches }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const current = branches.find((b) => b.id === currentBranchId)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function choose(branchId: string) {
    if (branchId === currentBranchId) { setOpen(false); return }
    setSwitchingId(branchId)
    start(async () => {
      const result = await switchActiveBranchAction(branchId)
      setSwitchingId(null)
      setOpen(false)
      if (result.success) {
        toast.success(`Switched to ${branches.find((b) => b.id === branchId)?.name}`)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to switch branch")
      }
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50"
        style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: branchColor(current?.name).dot }} />}
        <span>{current?.name ?? "Select branch"}</span>
        <ChevronDown className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.borderDivider }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-56 rounded-lg border bg-white shadow-lg overflow-hidden"
          style={{ borderColor: BRAND_COLORS.lightBackground }}
        >
          <p className="px-3 py-2 text-xs font-semibold border-b" style={{ color: BRAND_COLORS.borderDivider, borderColor: BRAND_COLORS.lightBackground }}>
            Your location today
          </p>
          {branches.map((b) => {
            const active = b.id === currentBranchId
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => choose(b.id)}
                disabled={pending}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
                style={{ color: active ? BRAND_COLORS.primaryTeal : BRAND_COLORS.bodyText, fontWeight: active ? 600 : 400 }}
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: branchColor(b.name).dot }} />
                  {b.name}
                </span>
                {switchingId === b.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : active ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
