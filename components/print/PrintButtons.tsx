"use client"

import { BRAND_COLORS } from "@/lib/constants"

interface Props {
  backHref?: string
}

export function PrintButtons({ backHref }: Props) {
  function handleBack() {
    if (backHref) {
      window.location.href = backHref
    } else if (window.history.length > 1) {
      window.history.back()
    } else {
      window.close()
    }
  }

  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-2 print:hidden">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 rounded-md text-sm font-semibold text-white shadow"
        style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
      >
        Print / Save PDF
      </button>
      <button
        onClick={handleBack}
        className="px-4 py-2 rounded-md text-sm border border-[#CCCCCC] bg-white"
        style={{ color: BRAND_COLORS.bodyText }}
      >
        Back
      </button>
    </div>
  )
}
