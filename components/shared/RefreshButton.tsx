"use client"

import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"

export function RefreshButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-[#E0E3E5] hover:bg-white transition-colors"
      style={{ color: BRAND_COLORS.borderDivider }}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Refresh
    </button>
  )
}
