import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { eventStatus, groupClaims, tierRule, type EventStatus } from "@/lib/offers"
import { offerService } from "@/server/services/offer.service"
import { ArrowLeft, CalendarClock, ChevronRight, Gift, ScrollText, Users } from "lucide-react"

export const metadata: Metadata = { title: "Event logs" }
export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<EventStatus, string> = {
  Live: "bg-emerald-100 text-emerald-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Full: "bg-amber-100 text-amber-700",
  Ended: "bg-gray-100 text-gray-600",
  Off: "bg-gray-100 text-gray-500",
}

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })

function duration(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60_000)
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || "0m"
}

/** Server render time (kept out of the component body for the purity lint). */
const currentTime = () => new Date()

/** /admin/events — every event offer with its timeline and counts; click for the full log. */
export default async function EventLogsPage() {
  await requireRole(["ADMIN"])
  const [events, now] = await Promise.all([offerService.listEvents(200), currentTime()])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/referrals" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Rewards &amp; Referrals
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ScrollText className="h-6 w-6 text-[#B7791F]" /> Event logs
          </h1>
          <p className="text-sm text-gray-500">Every event offer, when it ran, and who booked during it. Click an event for its full log.</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 ring-1 ring-black/5">
          No events yet — create one under Rewards &amp; Referrals → Event offers.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-5 py-3">Event</th>
                <th className="px-3 py-3">Timeline</th>
                <th className="px-3 py-3">Offers</th>
                <th className="px-3 py-3 text-right">Booked</th>
                <th className="px-3 py-3 text-right">To give</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const status = eventStatus(e, groupClaims(e.claims), now)
                const given = new Set(e.patientOffers.filter((p) => p.givenAt).map((p) => p.patientId))
                const toGive = e.patientOffers.length - given.size
                return (
                  <tr key={e.id} className="group border-b border-gray-50 last:border-0 hover:bg-[#FFFBF2]">
                    <td className="px-5 py-3">
                      <Link href={`/admin/events/${e.id}`} className="flex items-center gap-2 font-semibold text-gray-900 group-hover:underline">
                        <Gift className="h-4 w-4 text-[#B7791F]" /> {e.name}
                      </Link>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-gray-400" /> {fmt(e.startsAt)}
                      </span>
                      <span className="block pl-5 text-gray-400">→ {fmt(e.endsAt)} · {duration(e.startsAt, e.endsAt)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      {e.tiers.map((t, i) => (
                        <span key={i} className="block">
                          <span className="text-gray-400">{tierRule(t, i === 0)}:</span> {t.offer}{" "}
                          <strong className="tabular-nums text-gray-900">
                            {e.claims.filter((c) => c.tierIndex === i).length}
                            {t.limit ? `/${t.limit}` : ""}
                          </strong>
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-lg font-bold tabular-nums text-gray-900">
                        <Users className="h-4 w-4 text-gray-400" /> {e.claims.length}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-[#8A5A12]">{toGive || "—"}</td>
                    <td className="pr-4">
                      <Link href={`/admin/events/${e.id}`} aria-label={`Open ${e.name} log`}>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
