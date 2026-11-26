"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowButton, C, serif } from "@/components/rewards/Editorial"

/**
 * The live time-based event (e.g. Black Friday) on /rewards, in the editorial
 * style, linking straight to /book. Only rendered while an event is live; when
 * the current offer's window ends the page refreshes to the next one.
 */
export function LiveOfferStrip({
  eventName,
  offer,
  endsAt,
  nextOffer,
  terms,
}: {
  eventName: string
  offer: string
  endsAt: string // ISO
  nextOffer: string | null
  terms: string | null
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
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const ss = String(s % 60).padStart(2, "0")
  const short = s < 3600
  const until = new Date(endsAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })

  return (
    <section className="relative overflow-hidden border-y" style={{ backgroundColor: C.ink2, color: C.cream, borderColor: "rgba(183,154,115,.35)" }}>
      <div className="px-[6vw] py-12 sm:py-16 max-w-[1500px] mx-auto grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <span className="flex items-center gap-2.5 text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.16em]" style={{ color: C.gold }}>
            <i className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: C.gold }} />
            {eventName} · Live now
          </span>
          <h2 className="mt-5 text-[34px] sm:text-[52px] leading-[1.08] font-medium tracking-[-0.03em]">
            {short ? "Book in the next " : "Book today, "}
            {short && <span className="tabular-nums" style={{ color: C.gold }}>{h > 0 ? `${h}:` : ""}{mm}:{ss}</span>}
            <br />
            <em className="not-italic" style={serif}>get {offer}.</em>
          </h2>
          <p className="mt-5 max-w-[560px] text-[15px] leading-[1.8]" style={{ color: "rgba(246,241,232,.78)" }}>
            {short ? "" : `Offer ends at ${until}. `}
            {nextOffer ? `After that: ${nextOffer}.` : "Your offer is saved the moment you book."}
            {terms ? ` ${terms}` : ""}
          </p>
        </div>
        <div className="lg:justify-self-end">
          <ArrowButton href="/book">Book now</ArrowButton>
        </div>
      </div>
    </section>
  )
}
