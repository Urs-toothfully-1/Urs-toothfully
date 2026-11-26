import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { OFFER_SOURCE_LABEL, eventStatus, groupClaims, tierRule, tierWindows, type EventStatus } from "@/lib/offers"
import { offerService } from "@/server/services/offer.service"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, Gift, Hourglass, ScrollText, Users } from "lucide-react"

export const metadata: Metadata = { title: "Event log" }
export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<EventStatus, string> = {
  Live: "bg-emerald-100 text-emerald-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Full: "bg-amber-100 text-amber-700",
  Ended: "bg-gray-100 text-gray-600",
  Off: "bg-gray-100 text-gray-500",
}

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
const fmtSec = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" })

const ENDED_BY: Record<string, string> = {
  time: "time ran out",
  places: "all places taken",
  "event end": "event ended",
}

/** Server render time (kept out of the component body for the purity lint). */
const currentTime = () => new Date()

type Props = { params: Promise<{ eventId: string }> }

/** /admin/events/[id] — one event: totals, the offer timeline, and every booking in its log. */
export default async function EventLogPage({ params }: Props) {
  await requireRole(["ADMIN"])
  const { eventId } = await params
  const [e, now] = await Promise.all([offerService.getEvent(eventId), currentTime()])
  if (!e) notFound()

  const claims = groupClaims(e.claims)
  const status = eventStatus(e, claims, now)
  const windows = tierWindows(e, claims, now)
  const owed = new Map(e.patientOffers.map((p) => [p.patientId, p]))
  const rows = e.claims.map((c) => {
    const po = c.patientId ? owed.get(c.patientId) : undefined
    const state = !c.patientId ? "Awaiting confirmation" : po?.givenAt ? "Given" : "Confirmed — to give"
    return { ...c, po, state }
  })
  const count = (s: string) => rows.filter((r) => r.state === s).length

  const stats = [
    { label: "Booked", value: rows.length, icon: Users },
    { label: "Awaiting confirmation", value: count("Awaiting confirmation"), icon: Hourglass },
    { label: "Confirmed — to give", value: count("Confirmed — to give"), icon: Gift },
    { label: "Given", value: count("Given"), icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/events" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-3.5 w-3.5" /> All event logs
        </Link>
        <div className="mt-2 overflow-hidden rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg,#16120C,#4A3517)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-[#E2B04A] uppercase">
                <ScrollText className="h-3.5 w-3.5" /> Event log
              </p>
              <h1 className="mt-1 text-2xl font-bold">{e.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
                <CalendarClock className="h-4 w-4" /> {fmt(e.startsAt)} → {fmt(e.endsAt)}
              </p>
              <p className="mt-0.5 text-xs text-white/50">
                Created by {e.createdBy.name} · {fmt(e.createdAt)}
                {e.terms ? ` · Terms: ${e.terms}` : ""}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>{status}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-[#1d1711] px-5 py-3">
                <p className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-[#F5CE6B] tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Offer timeline */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900">
          <Clock className="h-4 w-4 text-[#B7791F]" /> Timeline
        </h2>
        <ol className="relative mt-4 space-y-4 border-l-2 border-[#E2B04A]/40 pl-6">
          <li className="relative">
            <span className="absolute top-0.5 -left-[31px] h-3.5 w-3.5 rounded-full border-2 border-white bg-[#B7791F] ring-2 ring-[#E2B04A]/40" />
            <p className="text-xs text-gray-500">{fmt(e.startsAt)}</p>
            <p className="text-sm font-semibold text-gray-900">Event starts</p>
          </li>
          {windows.map((w, i) => (
            <li key={i} className="relative">
              <span
                className={`absolute top-0.5 -left-[31px] h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${
                  w.start && !w.end ? "bg-emerald-500 ring-emerald-200" : w.start ? "bg-[#E2B04A] ring-[#E2B04A]/40" : "bg-gray-300 ring-gray-200"
                }`}
              />
              <p className="text-xs text-gray-500">
                {w.start ? fmt(w.start) : "Not reached"}
                {w.start && (w.end ? ` → ${fmt(w.end)}` : " → running now")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {tierRule(e.tiers[i], i === 0)}: <span className="text-[#8A5A12]">{w.offer}</span>
              </p>
              <p className="text-xs text-gray-500">
                <strong className="text-gray-800 tabular-nums">
                  {w.taken}
                  {e.tiers[i].limit ? ` of ${e.tiers[i].limit}` : ""}
                </strong>{" "}
                booked{w.endedBy ? ` · closed: ${ENDED_BY[w.endedBy]}` : ""}
              </p>
            </li>
          ))}
          <li className="relative">
            <span className="absolute top-0.5 -left-[31px] h-3.5 w-3.5 rounded-full border-2 border-white bg-gray-400 ring-2 ring-gray-200" />
            <p className="text-xs text-gray-500">{fmt(e.endsAt)}</p>
            <p className="text-sm font-semibold text-gray-900">Event ends — regular pricing</p>
          </li>
        </ol>
      </section>

      {/* Full log */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 px-5 pt-5 font-semibold text-gray-900">
          <Users className="h-4 w-4 text-[#B7791F]" /> Booking log · {rows.length}
        </h2>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">Nobody booked during this event.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/70 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                  <th className="px-5 py-2.5">#</th>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Offer</th>
                  <th className="px-3 py-2.5">How</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, n) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 text-xs text-gray-400 tabular-nums">{n + 1}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-gray-600">{fmtSec(r.at)}</td>
                    <td className="px-3 py-2.5">
                      {r.patientId ? (
                        <Link href={`/patients/${r.patientId}`} className="font-medium text-gray-900 hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-900">{r.name}</span>
                      )}
                      <span className="block text-[11px] text-gray-400">{r.mobile}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#7A4E0B]">🎁 {r.offer}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{OFFER_SOURCE_LABEL[r.source] ?? r.source}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          r.state === "Given"
                            ? "bg-emerald-50 text-emerald-700"
                            : r.state === "Awaiting confirmation"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-[#FDF3DC] text-[#7A4E0B]"
                        }`}
                      >
                        {r.state}
                      </span>
                      {r.po?.givenAt && (
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {fmt(r.po.givenAt)}
                          {r.po.givenBy ? ` · ${r.po.givenBy.name}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
