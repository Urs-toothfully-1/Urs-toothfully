"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createOfferEventAction,
  markOfferGivenAction,
  setOfferEventActiveAction,
  startOfferEventNowAction,
} from "@/actions/offers"
import { OFFER_SOURCE_LABEL, tierAt, type OfferTier } from "@/lib/offers"
import { Check, Gift, Loader2, Play, Plus, Power, Timer, Trash2, Undo2 } from "lucide-react"

export interface OfferEventView {
  id: string
  name: string
  startsAt: string // ISO
  endsAt: string
  tiers: OfferTier[]
  terms: string | null
  isActive: boolean
  qualified: {
    id: string
    patientId: string
    name: string
    code: string
    mobile: string
    offer: string
    qualifiedAt: string
    source: string
    givenAt: string | null
    givenBy: string | null
  }[]
  /** Online requests made during the event that reception hasn't confirmed yet. */
  pending: { id: string; name: string; mobile: string; offer: string; createdAt: string }[]
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/** "2026-11-27T19:00" in the browser's own (IST) clock, for <input type="datetime-local">. */
function localInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function statusOf(e: OfferEventView, now: number) {
  const ev = { ...e, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt) }
  if (!e.isActive) return { label: "Off", color: "#6B7280", tier: null }
  if (now < ev.startsAt.getTime()) return { label: "Scheduled", color: "#1D4ED8", tier: null }
  if (now >= ev.endsAt.getTime()) return { label: "Ended", color: "#6B7280", tier: null }
  return { label: "LIVE", color: "#047857", tier: tierAt(ev, new Date(now)) }
}

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  return h > 0 ? `${h}h ${m}m` : `${m}:${String(s % 60).padStart(2, "0")}`
}

function NewEventForm({ onDone }: { onDone: () => void }) {
  const today = new Date()
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 0, 0)
  const [name, setName] = useState("Black Friday")
  const [startsAt, setStartsAt] = useState(localInput(today))
  const [endsAt, setEndsAt] = useState(localInput(endOfDay))
  const [tiers, setTiers] = useState<{ minutes: string; offer: string }[]>([
    { minutes: "10", offer: "FREE professional teeth cleaning" },
    { minutes: "", offer: "Special Black Friday consultation benefit" },
  ])
  const [terms, setTerms] = useState("Choose your appointment date within the next 30 days.")
  const [pending, start] = useTransition()

  const setTier = (i: number, k: "minutes" | "offer", v: string) =>
    setTiers((t) => t.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  function save() {
    start(async () => {
      const res = await createOfferEventAction({
        name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        tiers: tiers.map((t) => ({ minutes: t.minutes.trim() ? Number(t.minutes) : null, offer: t.offer.trim() })),
        terms: terms.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${name} saved`)
      onDone()
    })
  }

  // `box` has no width so the tier row can size its fields; `input` fills its cell.
  const box = "h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
  const input = `${box} w-full`
  return (
    <div className="mt-4 rounded-2xl border border-[#E2B04A]/50 bg-[#FFFBF2] p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-gray-600 space-y-1">
          Event name <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <label className="text-xs font-medium text-gray-600 space-y-1">
          Countdown starts <input type="datetime-local" className={input} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-gray-600 space-y-1">
          Offer ends (then regular pricing) <input type="datetime-local" className={input} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Offers, in order (each starts when the previous one ends)</p>
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 w-14">{i === 0 ? "First" : "Then"}</span>
            <input className={`${box} w-20`} inputMode="numeric" placeholder="rest" value={t.minutes}
              onChange={(e) => setTier(i, "minutes", e.target.value.replace(/\D/g, ""))} aria-label="Minutes" />
            <span className="text-xs text-gray-500 w-24">{t.minutes ? "minutes →" : "until the end →"}</span>
            <input className={`${box} flex-1 min-w-[12rem]`} value={t.offer} maxLength={200}
              onChange={(e) => setTier(i, "offer", e.target.value)} placeholder="What they get" aria-label="Offer" />
            {tiers.length > 1 && (
              <button type="button" onClick={() => setTiers((x) => x.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-600" aria-label="Remove offer">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {tiers.length < 6 && (
          <button type="button" onClick={() => setTiers((x) => [...x, { minutes: "", offer: "" }])} className="text-xs font-semibold text-[#8A5A12] inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Add offer
          </button>
        )}
        <p className="text-[11px] text-gray-500">Leave minutes empty on the last offer to run it until the end time.</p>
      </div>

      <label className="block text-xs font-medium text-gray-600 space-y-1">
        Terms (shown on the booking page)
        <input className={input} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={1000} />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-9 rounded-lg border border-gray-200 px-3 text-sm">Cancel</button>
        <button type="button" onClick={save} disabled={pending}
          className="h-9 rounded-lg bg-[#8A5A12] px-4 text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save event
        </button>
      </div>
    </div>
  )
}

export function OfferEventManager({ events }: { events: OfferEventView[] }) {
  const now = useNow()
  const [creating, setCreating] = useState(events.length === 0)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else toast.success(ok)
    })

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#B7791F]" /> Event offers
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Time-limited offers like Black Friday. Anyone who books online (urstoothfully.org/book), registers, or books on WhatsApp
            inside a window is tagged with that offer. It shows on their profile until marked given.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="h-9 rounded-lg bg-[#8A5A12] px-3 text-sm font-semibold text-white inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New event
          </button>
        )}
      </div>

      {creating && <NewEventForm onDone={() => setCreating(false)} />}

      <div className="mt-4 space-y-4">
        {events.map((e) => {
          const st = statusOf(e, now)
          const open = e.qualified.filter((q) => !q.givenAt).length
          return (
            <div key={e.id} className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" style={{ background: st.label === "LIVE" ? "linear-gradient(135deg,#16120C,#4A3517)" : "#F9FAFB" }}>
                <div className={st.label === "LIVE" ? "text-white" : "text-gray-900"}>
                  <p className="font-semibold flex items-center gap-2">
                    {e.name}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}22`, color: st.label === "LIVE" ? "#6EE7B7" : st.color }}>
                      {st.label === "LIVE" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />}
                      {st.label}
                    </span>
                  </p>
                  <p className={`text-xs mt-0.5 ${st.label === "LIVE" ? "text-white/70" : "text-gray-500"}`}>
                    {fmt(e.startsAt)} → {fmt(e.endsAt)}
                  </p>
                  {st.tier && (
                    <p className="mt-1.5 text-sm flex items-center gap-1.5">
                      <Timer className="h-4 w-4 text-[#E2B04A]" />
                      Now: <strong className="text-[#F5CE6B]">{st.tier.offer}</strong>
                      <span className="text-white/70">· {left(st.tier.endsAt.getTime() - now)} left</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {st.label !== "Ended" && (
                    <button type="button" disabled={pending}
                      onClick={() => run(() => startOfferEventNowAction(e.id), `${e.name} started — the countdown is running`)}
                      className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                      title="Starts the first offer's countdown right now, e.g. when you post the flyer">
                      <Play className="h-3.5 w-3.5" /> Start now
                    </button>
                  )}
                  <button type="button" disabled={pending}
                    onClick={() => run(() => setOfferEventActiveAction(e.id, !e.isActive), e.isActive ? "Event switched off" : "Event switched on")}
                    className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 inline-flex items-center gap-1.5">
                    <Power className="h-3.5 w-3.5" /> {e.isActive ? "Turn off" : "Turn on"}
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-gray-100">
                <ol className="flex flex-wrap gap-2 text-xs">
                  {e.tiers.map((t, i) => (
                    <li key={i} className={`rounded-full px-2.5 py-1 ${st.tier?.index === i ? "bg-[#FDEBC2] text-[#7A4E0B] font-semibold" : "bg-gray-100 text-gray-600"}`}>
                      {i === 0 ? "First" : "Then"} {t.minutes ? `${t.minutes} min` : "until the end"}: {t.offer}
                    </li>
                  ))}
                  <li className="rounded-full px-2.5 py-1 bg-gray-50 text-gray-400">After: regular pricing</li>
                </ol>
              </div>

              <div className="border-t border-gray-100">
                <p className="px-4 pt-3 text-xs font-semibold text-gray-700">
                  Qualified patients · {e.qualified.length} {open > 0 && <span className="text-[#8A5A12]">({open} still to give)</span>}
                </p>
                {e.qualified.length === 0 && e.pending.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-500">Nobody yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-2">
                      <tbody>
                        {e.qualified.map((q) => (
                          <tr key={q.id} className="border-t border-gray-50">
                            <td className="py-2 pl-4 pr-2">
                              <Link href={`/patients/${q.patientId}`} className="font-medium text-gray-900 hover:underline">{q.name}</Link>
                              <span className="block text-[11px] text-gray-400">{q.code} · {q.mobile}</span>
                            </td>
                            <td className="py-2 px-2 text-xs font-semibold text-[#7A4E0B]">🎁 {q.offer}</td>
                            <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">{fmt(q.qualifiedAt)} · {OFFER_SOURCE_LABEL[q.source] ?? q.source}</td>
                            <td className="py-2 pl-2 pr-4 text-right">
                              {q.givenAt ? (
                                <button type="button" disabled={pending} onClick={() => run(() => markOfferGivenAction(q.id, false), "Marked as not given")}
                                  className="text-xs text-gray-500 inline-flex items-center gap-1" title={q.givenBy ? `Given by ${q.givenBy}` : undefined}>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Given <Undo2 className="h-3 w-3" />
                                </button>
                              ) : (
                                <button type="button" disabled={pending} onClick={() => run(() => markOfferGivenAction(q.id, true), `${q.offer} given to ${q.name}`)}
                                  className="h-7 rounded-full bg-[#8A5A12] px-2.5 text-[11px] font-semibold text-white inline-flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Mark given
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {e.pending.map((r) => (
                          <tr key={r.id} className="border-t border-gray-50 bg-amber-50/40">
                            <td className="py-2 pl-4 pr-2">
                              <span className="font-medium text-gray-900">{r.name}</span>
                              <span className="block text-[11px] text-gray-400">{r.mobile}</span>
                            </td>
                            <td className="py-2 px-2 text-xs font-semibold text-[#7A4E0B]">🎁 {r.offer}</td>
                            <td className="py-2 px-2 text-xs text-gray-500 whitespace-nowrap">{fmt(r.createdAt)} · Online booking</td>
                            <td className="py-2 pl-2 pr-4 text-right">
                              <Link href="/appointments" className="text-[11px] font-semibold text-amber-700 hover:underline">Confirm booking →</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
