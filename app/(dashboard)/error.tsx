"use client"

import { useEffect } from "react"
import { BRAND_COLORS } from "@/lib/constants"
import { AlertCircle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <AlertCircle className="h-12 w-12" style={{ color: "#EF4444" }} />
      <div>
        <h2 className="text-lg font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
          Something went wrong
        </h2>
        <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
        >
          Try Again
        </button>
        <a
          href="/reception"
          className="px-4 py-2 rounded-md text-sm font-medium border border-[#CCCCCC]"
          style={{ color: BRAND_COLORS.bodyText }}
        >
          Go to Reception
        </a>
      </div>
    </div>
  )
}
