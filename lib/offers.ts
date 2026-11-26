/**
 * Event offers (Black Friday etc.): which offer applies at a given moment.
 * Tiers run back to back from the event start. A tier ends when its minutes run
 * out OR its places are taken ("first 60 min or first 100 patients"), whichever
 * comes first; the next tier starts right then. A tier with neither runs to the
 * event end. Pure — see qa/check-offers.ts.
 */

export type OfferTier = {
  minutes: number | null
  /** Places: the first N patients. */
  limit: number | null
  offer: string
}

export interface OfferWindow {
  startsAt: Date
  endsAt: Date
  tiers: OfferTier[]
  isActive: boolean
}

export type TierHit = {
  index: number
  offer: string
  /** When this tier's time runs out (the countdown target). */
  endsAt: Date
  /** The offer that follows, if any. */
  nextOffer: string | null
  limit: number | null
  /** Places taken in this tier so far. */
  claimed: number
  /** Places left (null = no place limit). */
  remaining: number | null
}

/** Reads the tiers JSON stored on an OfferEvent, dropping anything malformed. */
export function parseTiers(json: unknown): OfferTier[] {
  if (!Array.isArray(json)) return []
  const posInt = (v: unknown) => (typeof v === "number" && v > 0 ? Math.round(v) : null)
  return json
    .filter((t): t is { minutes?: unknown; limit?: unknown; offer?: unknown } => !!t && typeof t === "object")
    .map((t) => ({
      minutes: posInt(t.minutes),
      limit: posInt(t.limit),
      offer: typeof t.offer === "string" ? t.offer.trim().slice(0, 200) : "",
    }))
    .filter((t) => t.offer)
}

/**
 * The tier that applies at `at`, or null (not started, ended, switched off, all
 * places gone). `claims[i]` = times of the places already taken in tier i,
 * oldest first — a full tier closes at the moment its last place was taken.
 */
export function tierAt(e: OfferWindow, at: Date, claims: Date[][] = []): TierHit | null {
  const t = at.getTime()
  const end = e.endsAt.getTime()
  if (!e.isActive || t < e.startsAt.getTime() || t >= end) return null
  let start = e.startsAt.getTime()
  for (let i = 0; i < e.tiers.length; i++) {
    const tier = e.tiers[i]
    const timeEnd = tier.minutes == null ? end : Math.min(start + tier.minutes * 60_000, end)
    const taken = (claims[i] ?? []).filter((c) => c.getTime() <= t)
    const fullAt = tier.limit != null && taken.length >= tier.limit ? taken[tier.limit - 1].getTime() : Infinity
    const tierEnd = Math.min(timeEnd, fullAt)
    if (t < tierEnd)
      return {
        index: i,
        offer: tier.offer,
        endsAt: new Date(timeEnd),
        // An open tier (no time, no places) runs to the end: nothing follows it.
        nextOffer: timeEnd < end || tier.limit != null ? (e.tiers[i + 1]?.offer ?? null) : null,
        limit: tier.limit,
        claimed: taken.length,
        remaining: tier.limit == null ? null : tier.limit - taken.length,
      }
    start = tierEnd
  }
  return null
}

/** First event with a tier live at `at`. `claimsFor` gives each event's claims by tier. */
export function liveOffer<E extends OfferWindow & { id?: string }>(
  events: E[],
  at: Date,
  claimsFor: (e: E) => Date[][] = () => []
): { event: E; tier: TierHit } | null {
  for (const event of events) {
    const tier = tierAt(event, at, claimsFor(event))
    if (tier) return { event, tier }
  }
  return null
}

/** "First 10 min", "First 100 patients", "First 60 min or 100 patients", "Until the end". */
export function tierRule(t: Pick<OfferTier, "minutes" | "limit">, first: boolean): string {
  const lead = first ? "First" : "Next"
  if (t.minutes && t.limit) return `${lead} ${t.minutes} min or ${t.limit} patients`
  if (t.minutes) return `${lead} ${t.minutes} min`
  if (t.limit) return `${lead} ${t.limit} patients`
  return first ? "Until the end" : "Then until the end"
}

export const OFFER_SOURCE_LABEL: Record<string, string> = {
  BOOKING: "Online booking",
  INTAKE: "Online registration",
  DESK: "Registered at clinic",
  WHATSAPP: "WhatsApp booking",
}
