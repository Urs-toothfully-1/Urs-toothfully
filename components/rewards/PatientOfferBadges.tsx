"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { markOfferGivenAction } from "@/actions/offers"
import { Check, Gift, Loader2, Undo2 } from "lucide-react"

export interface PatientOfferView {
  id: string
  eventName: string
  offer: string
  qualifiedAt: string // ISO
  givenAt: string | null
  givenBy: string | null
}

/** Event offers this patient qualified for (e.g. Black Friday), shown in the profile header. */
export function PatientOfferBadges({ offers }: { offers: PatientOfferView[] }) {
  const [pending, start] = useTransition()
  if (offers.length === 0) return null

  const toggle = (o: PatientOfferView) =>
    start(async () => {
      const res = await markOfferGivenAction(o.id, !o.givenAt)
      if (res.error) toast.error(res.error)
      else toast.success(o.givenAt ? "Marked as not given" : `${o.offer} — marked as given`)
    })

  return (
    <div className="flex flex-col md:items-end gap-1.5">
      {offers.map((o) => {
        const when = new Date(o.qualifiedAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
        })
        return o.givenAt ? (
          <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500"
            title={`Qualified ${when}${o.givenBy ? ` · given by ${o.givenBy}` : ""}`}>
            <Check className="h-3.5 w-3.5" /> {o.eventName}: {o.offer} — given
            <button type="button" onClick={() => toggle(o)} disabled={pending} className="ml-1 hover:text-gray-800" aria-label="Undo given">
              <Undo2 className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <span key={o.id} className="inline-flex items-center gap-2 rounded-full border border-[#E2B04A] bg-gradient-to-r from-[#FFF6DF] to-[#FDEBC2] py-1 pl-2.5 pr-1 text-xs font-semibold text-[#7A4E0B] shadow-sm"
            title={`Qualified ${when}`}>
            <Gift className="h-3.5 w-3.5" /> {o.eventName}: {o.offer}
            <button type="button" onClick={() => toggle(o)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-full bg-[#8A5A12] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#6F470D] disabled:opacity-60">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Mark given
            </button>
          </span>
        )
      })}
    </div>
  )
}
