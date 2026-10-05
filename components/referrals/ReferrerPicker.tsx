"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { linkReferrerAction, lookupReferrerAction } from "@/actions/referrals"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Loader2, Search, X } from "lucide-react"

type Candidate = { id: string; fullName: string; patientId: string; mobile: string }

/**
 * Find the referrer by referral code or mobile number.
 * - With `refereeId`: links the referrer to that existing patient on confirm.
 * - Without: a form field — the chosen referrer's id is posted as `referrerId`.
 */
export function ReferrerPicker({ refereeId, excludeId }: { refereeId?: string; excludeId?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [chosen, setChosen] = useState<Candidate | null>(null)
  const [pending, startTransition] = useTransition()

  function search() {
    if (query.trim().length < 4) { toast.error("Enter a referral code or a 10-digit mobile number."); return }
    startTransition(async () => {
      const res = await lookupReferrerAction(query)
      if (res.error) { toast.error(res.error); return }
      const list = res.candidates.filter((c) => c.id !== (refereeId ?? excludeId))
      setCandidates(list)
      if (list.length === 1) setChosen(list[0])
    })
  }

  function link(c: Candidate) {
    if (!refereeId) { setChosen(c); return }
    startTransition(async () => {
      const res = await linkReferrerAction(refereeId, c.id)
      if (res.success) {
        toast.success(`Referred by ${c.fullName} recorded`)
        router.refresh()
      } else toast.error(res.error ?? "Failed to link referrer")
    })
  }

  if (chosen && !refereeId) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" style={{ borderColor: BRAND_COLORS.primaryTeal }}>
        <input type="hidden" name="referrerId" value={chosen.id} />
        <Check className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
        <span style={{ color: BRAND_COLORS.bodyText }}>
          <strong>{chosen.fullName}</strong> <span className="font-mono text-xs">({chosen.patientId})</span>
        </span>
        <button type="button" className="ml-auto" aria-label="Clear referrer" onClick={() => { setChosen(null); setCandidates(null) }}>
          <X className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCandidates(null) }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search() } }}
          placeholder="Referral code or mobile no."
          maxLength={20}
          className="h-9"
        />
        <Button type="button" variant="outline" onClick={search} disabled={pending} className="h-9 gap-1.5">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
        </Button>
      </div>
      {candidates?.length === 0 && (
        <p className="text-xs" style={{ color: "#B45309" }}>No patient found with that code or mobile.</p>
      )}
      {candidates && candidates.length > 0 && (refereeId || candidates.length > 1) && (
        <div className="rounded-md border divide-y" style={{ borderColor: "#E0E3E5" }}>
          {candidates.length > 1 && (
            <p className="px-3 py-1.5 text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>
              This mobile is shared — pick the person who referred.
            </p>
          )}
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pending}
              onClick={() => link(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#F2F4F6] flex justify-between gap-2"
            >
              <span style={{ color: BRAND_COLORS.bodyText }}>
                {c.fullName} <span className="font-mono text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{c.patientId}</span>
              </span>
              <span className="text-xs font-medium" style={{ color: BRAND_COLORS.primaryTeal }}>
                {refereeId ? "Set as referrer" : "Select"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
