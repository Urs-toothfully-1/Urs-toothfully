"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback"

interface Props {
  defaultValue?: string
  placeholder?: string
}

export function PatientSearchInput({
  defaultValue = "",
  placeholder = "Search by name, mobile, patient ID or email…",
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page") // new search always starts at page 1
    if (term.trim().length >= 2) {
      params.set("q", term.trim())
    } else {
      params.delete("q")
    }
    startTransition(() => {
      router.push(`/patients?${params.toString()}`)
    })
  }, 300)

  return (
    <div className="relative">
      {isPending ? (
        <Loader2
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin"
          style={{ color: BRAND_COLORS.primaryTeal }}
        />
      ) : (
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: BRAND_COLORS.borderDivider }}
        />
      )}
      <Input
        type="search"
        defaultValue={defaultValue}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="pl-10 h-11 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-white"
        autoFocus
      />
    </div>
  )
}
