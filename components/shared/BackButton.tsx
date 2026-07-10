"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"

interface Props {
  /** Optional explicit destination; defaults to browser back (router.back). */
  fallbackHref?: string
  label?: string
}

export function BackButton({ fallbackHref, label = "Back" }: Props) {
  const router = useRouter()

  function goBack() {
    // Prefer real history back so the doctor returns exactly where they came from
    // (e.g. the treatment session) without saving anything.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else if (fallbackHref) {
      router.push(fallbackHref)
    } else {
      router.back()
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium rounded-md border px-3 py-1.5 transition-colors hover:bg-gray-50"
      style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  )
}
