"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createOfferEventAction,
  markOfferGivenAction,
  setOfferEventActiveAction,
  deleteOfferEventAction,
  startOfferEventNowAction,
} from "@/actions/offers"
import { OFFER_SOURCE_LABEL, tierAt, tierRule, type OfferTier } from "@/lib/offers"
import { Check, Gift, Loader2, Play, Plus, Power, ScrollText, Timer, Trash2, Undo2, Users } from "lucide-react"

/** One row of an event's booking log (saved when the person qualified). */
export interface OfferLogEntry {
  id: string
  name: string
  mobile: string
  offer: string
  tierIndex: number
  at: string // ISO
  source: string
  /** Set once the patient record exists (confirmed booking / registration). */
  patientId: string | null
  /** The offer owed to the patient, once linked. */
  patientOfferId: string | null
  givenAt: string | null
  givenBy: string | null
}

export interface OfferEventView {
  id: string
  name: string
  startsAt: string // ISO
  endsAt: string
  tiers: OfferTier[]
  terms: string | null
  isActive: boolean
  log: OfferLogEntry[]
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })

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

/** The log's claim times grouped by tier — what tierAt needs for place limits. */
function claimsByTier(e: OfferEventView): Date[][] {
  const out: Date[][] = []
  for (const r of e.log) (out[r.tierIndex] ??= []).push(new Date(r.at))
  return out
}

function statusOf(e: OfferEventView, now: number) {
  const ev = { ...e, startsAt: new Date(e.startsAt), endsAt: new Date(e.endsAt) }
  if (!e.isActive) return { label: "Off", color: "#6B7280", tier: null }
  if (now < ev.startsAt.getTime()) return { label: "Scheduled", color: "#1D4ED8", tier: null }
  if (now >= ev.endsAt.getTime()) return { label: "Ended", color: "#6B7280", tier: null }
  const tier = tierAt(ev, new Date(now), claimsByTier(e))
  // All places taken and nothing after: the event is effectively over.
  return tier
    ? { label: "LIVE", color: "#047857", tier }
    : { label: "Full", color: "#B45309", tier: null }
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
  const [tiers, setTiers] = useState<{ minutes: string; limit: string; offer: string }[]>([
    { minutes: "10", limit: "", offer: "FREE professional teeth cleaning" },
    { minutes: "", limit: "", offer: "Special Black Friday consultation benefit" },
  ])
  const [terms, setTerms] = useState("Choose your appointment date within the next 30 days.")
  const [pending, start] = useTransition()
  // The start defaults to now; make "this goes live the moment you save" obvious.
  const now = useNow(5000)
  const goesLiveNow = new Date(startsAt).getTime() <= now

  const setTier = (i: number, k: "minutes" | "limit" | "offer", v: string) =>
    setTiers((t) => t.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const num = (v: string) => (v.trim() ? Number(v) : null)

  function save() {
    start(async () => {
      const res = await createOfferEventAction({
        name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        tiers: tiers.map((t) => ({
          minutes: num(t.minutes),
          limit: num(t.limit),
          offer: t.offer.trim(),
        })),
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
    <div className="mt-4 space-y-3 rounded-2xl border border-[#E2B04A]/50 bg-[#FFFBF2] p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Event name{" "}
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Countdown starts{" "}
          <input
            type="datetime-local"
            className={input}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-gray-600">
          Offer ends (then regular pricing){" "}
          <input
            type="datetime-local"
            className={input}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">
          Offers, in order. Each lasts for its minutes <em>or</em> until its places are taken,
          whichever comes first — then the next one starts.
        </p>
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/60 p-2">
            <span className="w-10 text-xs font-semibold text-gray-500">
              {i === 0 ? "First" : "Then"}
            </span>
            <input
              className={`${box} w-20`}
              inputMode="numeric"
              placeholder="—"
              value={t.minutes}
              onChange={(e) => setTier(i, "minutes", e.target.value.replace(/\D/g, ""))}
              aria-label="Minutes"
            />
            <span className="text-xs text-gray-500">min</span>
            <span className="text-xs font-semibold text-gray-400">or</span>
            <input
              className={`${box} w-24`}
              inputMode="numeric"
              placeholder="—"
              value={t.limit}
              onChange={(e) => setTier(i, "limit", e.target.value.replace(/\D/g, ""))}
              aria-label="First N patients"
            />
            <span className="text-xs text-gray-500">patients →</span>
            <input
              className={`${box} min-w-[12rem] flex-1`}
              value={t.offer}
              maxLength={200}
              onChange={(e) => setTier(i, "offer", e.target.value)}
              placeholder="What they get"
              aria-label="Offer"
            />
            <span className="w-full pl-12 text-[11px] text-[#8A5A12]">
              {tierRule({ minutes: num(t.minutes), limit: num(t.limit) }, i === 0)}
            </span>
            {tiers.length > 1 && (
              <button
                type="button"
                onClick={() => setTiers((x) => x.filter((_, j) => j !== i))}
                className="ml-auto p-1.5 text-gray-400 hover:text-red-600"
                aria-label="Remove offer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {tiers.length < 6 && (
          <button
            type="button"
            onClick={() => setTiers((x) => [...x, { minutes: "", limit: "", offer: "" }])}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A5A12]"
          >
            <Plus className="h-3.5 w-3.5" /> Add offer
          </button>
        )}
        <p className="text-[11px] text-gray-500">
          Examples: <strong>10</strong> min → first 10 minutes · <strong>1000</strong> patients →
          first 1000 bookings · <strong>60</strong> min or <strong>100</strong> patients → whichever
          comes first. Leave both empty to run until the end time.
        </p>
      </div>

      <label className="block space-y-1 text-xs font-medium text-gray-600">
        Terms (shown on the booking page)
        <input
          className={input}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          maxLength={1000}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${
            goesLiveNow ? "bg-red-600" : "bg-[#8A5A12]"
          }`}
          title={
            goesLiveNow
              ? "The start time is now or past — patients will see it immediately"
              : undefined
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
          {goesLiveNow ? "Save & go live NOW" : "Save event"}
        </button>
      </div>
    </div>
  )
}

export function OfferEventManager({ events }: { events: OfferEventView[] }) {
  const now = useNow()
  const [creating, setCreating] = useState(events.length === 0)
  const [pending, start] = useTransition()
  // Two-step delete without a browser confirm(): first click arms it for 5 s.
  const [armed, setArmed] = useState<string | null>(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 5000)
    return () => clearTimeout(t)
  }, [armed])

  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else toast.success(ok)
    })

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <Gift className="h-4 w-4 text-[#B7791F]" /> Event offers
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Time- or place-limited offers like Black Friday. Everyone who books online, registers,
            or books on WhatsApp during an offer is saved in the event&apos;s log and tagged with it
            until marked given.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/events"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2B04A] bg-[#FFFBF2] px-3 text-sm font-semibold text-[#8A5A12] hover:bg-[#FDF3DC]"
          >
            <ScrollText className="h-4 w-4" /> Event logs
          </Link>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#8A5A12] px-3 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New event
          </button>
        )}
        </div>
      </div>

      {creating && <NewEventForm onDone={() => setCreating(false)} />}

      <div className="mt-4 space-y-4">
        {events.map((e) => {
          const st = statusOf(e, now)
          const perTier = e.tiers.map((_, i) => e.log.filter((r) => r.tierIndex === i).length)
          const toGive = e.log.filter((r) => r.patientOfferId && !r.givenAt).length
          const awaiting = e.log.filter((r) => !r.patientId).length
          const live = st.label === "LIVE"
          return (
            <div key={e.id} className="overflow-hidden rounded-2xl border border-gray-200">
              <div
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                style={{ background: live ? "linear-gradient(135deg,#16120C,#4A3517)" : "#F9FAFB" }}
              >
                <div className={live ? "text-white" : "text-gray-900"}>
                  <p className="flex items-center gap-2 font-semibold">
                    <Link href={`/admin/events/${e.id}`} className="hover:underline" title="Open this event's log">
                      {e.name}
                    </Link>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: `${st.color}22`,
                        color: live ? "#6EE7B7" : st.color,
                      }}
                    >
                      {live && (
                        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                      )}
                      {st.label}
                    </span>
                  </p>
                  <p className={`mt-0.5 text-xs ${live ? "text-white/70" : "text-gray-500"}`}>
                    {fmt(e.startsAt)} → {fmt(e.endsAt)}
                  </p>
                  {st.tier && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
                      <Timer className="h-4 w-4 text-[#E2B04A]" />
                      Now: <strong className="text-[#F5CE6B]">{st.tier.offer}</strong>
                      <span className="text-white/70">
                        · {left(st.tier.endsAt.getTime() - now)} left
                        {st.tier.remaining != null &&
                          ` · ${st.tier.remaining} of ${st.tier.limit} places left`}
                      </span>
                    </p>
                  )}
                </div>

                {/* Counter */}
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl px-3 py-1.5 text-right ${live ? "bg-white/10" : "bg-white ring-1 ring-gray-200"}`}
                  >
                    <p
                      className={`flex items-center justify-end gap-1 text-[11px] ${live ? "text-white/70" : "text-gray-500"}`}
                    >
                      <Users className="h-3 w-3" /> Booked
                    </p>
                    <p
                      className={`text-2xl font-bold tabular-nums ${live ? "text-[#F5CE6B]" : "text-gray-900"}`}
                    >
                      {e.log.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {st.label !== "Ended" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => startOfferEventNowAction(e.id),
                            `${e.name} started — the countdown is running`
                          )
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
                        title="Starts the first offer's countdown right now, e.g. when you post the flyer"
                      >
                        <Play className="h-3.5 w-3.5" /> Start now
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => setOfferEventActiveAction(e.id, !e.isActive),
                          e.isActive ? "Event switched off" : "Event switched on"
                        )
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700"
                    >
                      <Power className="h-3.5 w-3.5" /> {e.isActive ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (armed !== e.id) return setArmed(e.id)
                        setArmed(null)
                        run(() => deleteOfferEventAction(e.id), `${e.name} deleted`)
                      }}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
                        armed === e.id
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-gray-300 bg-white text-red-600"
                      }`}
                      title="Deletes the event, its booking log and its patient tags"
                    >
                      <Trash2 className="h-3.5 w-3.5" />{" "}
                      {armed === e.id ? "Click again to delete" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Offers with their counts */}
              <div className="border-t border-gray-100 px-4 py-3">
                <ol className="flex flex-wrap gap-2 text-xs">
                  {e.tiers.map((t, i) => (
                    <li
                      key={i}
                      className={`rounded-full px-2.5 py-1 ${st.tier?.index === i ? "bg-[#FDEBC2] font-semibold text-[#7A4E0B]" : "bg-gray-100 text-gray-600"}`}
                    >
                      {tierRule(t, i === 0)}: {t.offer}
                      <span className="ml-1.5 rounded-full bg-white/70 px-1.5 font-bold tabular-nums">
                        {perTier[i]}
                        {t.limit ? `/${t.limit}` : ""}
                      </span>
                    </li>
                  ))}
                  <li className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-400">
                    After: regular pricing
                  </li>
                </ol>
              </div>

              {/* Booking log */}
              <div className="border-t border-gray-100">
                <p className="px-4 pt-3 text-xs font-semibold text-gray-700">
                  Booking log · {e.log.length}
                  {awaiting > 0 && (
                    <span className="ml-1 text-amber-700">· {awaiting} awaiting confirmation</span>
                  )}
                  {toGive > 0 && (
                    <span className="ml-1 text-[#8A5A12]">· {toGive} still to give</span>
                  )}
                </p>
                {e.log.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-500">Nobody yet.</p>
                ) : (
                  <div className="max-h-[420px] overflow-auto">
                    <table className="mt-2 w-full text-sm">
                      <tbody>
                        {e.log.map((r, n) => (
                          <tr
                            key={r.id}
                            className={`border-t border-gray-50 ${!r.patientId ? "bg-amber-50/40" : ""}`}
                          >
                            <td className="w-8 py-2 pl-4 text-[11px] text-gray-400 tabular-nums">
                              {n + 1}
                            </td>
                            <td className="py-2 pr-2">
                              {r.patientId ? (
                                <Link
                                  href={`/patients/${r.patientId}`}
                                  className="font-medium text-gray-900 hover:underline"
                                >
                                  {r.name}
                                </Link>
                              ) : (
                                <span className="font-medium text-gray-900">{r.name}</span>
                              )}
                              <span className="block text-[11px] text-gray-400">{r.mobile}</span>
                            </td>
                            <td className="px-2 py-2 text-xs font-semibold text-[#7A4E0B]">
                              🎁 {r.offer}
                            </td>
                            <td className="px-2 py-2 text-xs whitespace-nowrap text-gray-500">
                              {fmt(r.at)} · {OFFER_SOURCE_LABEL[r.source] ?? r.source}
                            </td>
                            <td className="py-2 pr-4 pl-2 text-right">
                              {!r.patientId ? (
                                <Link
                                  href="/appointments"
                                  className="text-[11px] font-semibold text-amber-700 hover:underline"
                                >
                                  Awaiting confirmation →
                                </Link>
                              ) : !r.patientOfferId ? null : r.givenAt ? (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    run(
                                      () => markOfferGivenAction(r.patientOfferId!, false),
                                      "Marked as not given"
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-gray-500"
                                  title={r.givenBy ? `Given by ${r.givenBy}` : undefined}
                                >
                                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Given{" "}
                                  <Undo2 className="h-3 w-3" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    run(
                                      () => markOfferGivenAction(r.patientOfferId!, true),
                                      `${r.offer} given to ${r.name}`
                                    )
                                  }
                                  className="inline-flex h-7 items-center gap-1 rounded-full bg-[#8A5A12] px-2.5 text-[11px] font-semibold text-white"
                                >
                                  <Check className="h-3 w-3" /> Mark given
                                </button>
                              )}
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
