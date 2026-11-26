"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Gift, Timer } from "lucide-react"

/**
 * Live event offer on the booking page, e.g. "Black Friday — book in the next
 * 07:42 to get a FREE teeth cleaning". When the tier ends the page refreshes
 * to show the next offer (the server decides who qualifies, by submit time).
 */
export function OfferCountdownBanner({
  eventName,
  offer,
  endsAt,
  nextOffer,
  terms,
  limit = null,
}: {
  eventName: string
  offer: string
  endsAt: string // ISO
  nextOffer: string | null
  terms: string | null
  /** "First N patients" offers: patients see the total only, never places left. */
  limit?: number | null
}) {
  const router = useRouter()
  const [left, setLeft] = useState(() => new Date(endsAt).getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(endsAt).getTime() - Date.now()
      setLeft(ms)
      if (ms <= 0) {
        clearInterval(id)
        router.refresh()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, router])

  const s = Math.max(0, Math.floor(left / 1000))
  const hh = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  const short = s < 3600 // a real countdown under an hour; otherwise "until 11:59 PM"
  const until = new Date(endsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })

  return (
    <div className="mb-5 overflow-hidden rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, #16120C 0%, #2A2116 60%, #4A3517 100%)" }}>
      <div className="px-5 pt-4 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#E2B04A]">
          {eventName} · Book today
        </p>
        <p className="mt-2 flex items-start gap-2 text-lg font-bold leading-snug">
          <Gift className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#E2B04A]" />
          <span>
            {short ? "Book in the next " : "Book today to get "}
            {short && <span className="tabular-nums text-[#F5CE6B]">{hh > 0 ? `${hh}:` : ""}{mm}:{ss}</span>}
            {short ? " to get " : ""}
            <span className="text-[#F5CE6B]">{offer}</span>
          </span>
        </p>
        {limit != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E2B04A]/20 px-2.5 py-1 text-xs font-semibold text-[#F5CE6B]">
            🔥 For the first {limit} patients only
          </p>
        )}
        {!short && <p className="mt-1 text-xs text-white/70">Offer ends at {until}.</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-2 text-xs text-white/75">
        <Timer className="h-3.5 w-3.5 text-[#E2B04A]" />
        {nextOffer ? `After that: ${nextOffer}` : "Fill the form below — your offer is saved the moment you submit."}
      </div>
      {terms && <p className="px-5 pb-3 pt-1 text-[11px] leading-snug text-white/55">{terms}</p>}
    </div>
  )
}
