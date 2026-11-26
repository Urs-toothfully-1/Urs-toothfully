/**
 * Event offers (Black Friday etc.): which offer applies to something done at a
 * given moment. Tiers run back to back from the event start; a tier without
 * minutes lasts until the event ends. Pure — see qa/check-offers.ts.
 */

export type OfferTier = { minutes: number | null; offer: string }

export interface OfferWindow {
  startsAt: Date
  endsAt: Date
  tiers: OfferTier[]
  isActive: boolean
}

export type TierHit = {
  index: number
  offer: string
  /** When this tier stops applying (the countdown target). */
  endsAt: Date
  /** The offer that follows, if any. */
  nextOffer: string | null
}

/** Reads the tiers JSON stored on an OfferEvent, dropping anything malformed. */
export function parseTiers(json: unknown): OfferTier[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((t): t is { minutes?: unknown; offer?: unknown } => !!t && typeof t === "object")
    .map((t) => ({
      minutes: typeof t.minutes === "number" && t.minutes > 0 ? Math.round(t.minutes) : null,
      offer: typeof t.offer === "string" ? t.offer.trim().slice(0, 200) : "",
    }))
    .filter((t) => t.offer)
}

/** The tier that applies at `at`, or null (not started, ended, switched off). */
export function tierAt(e: OfferWindow, at: Date): TierHit | null {
  const t = at.getTime()
  const end = e.endsAt.getTime()
  if (!e.isActive || t < e.startsAt.getTime() || t >= end) return null
  let start = e.startsAt.getTime()
  for (let i = 0; i < e.tiers.length; i++) {
    const tier = e.tiers[i]
    const tierEnd = tier.minutes == null ? end : Math.min(start + tier.minutes * 60_000, end)
    if (t < tierEnd)
      return {
        index: i,
        offer: tier.offer,
        endsAt: new Date(tierEnd),
        nextOffer: tierEnd < end ? (e.tiers[i + 1]?.offer ?? null) : null,
      }
    start = tierEnd
  }
  return null
}

/** First event with a tier live at `at`. */
export function liveOffer<E extends OfferWindow>(events: E[], at: Date): { event: E; tier: TierHit } | null {
  for (const event of events) {
    const tier = tierAt(event, at)
    if (tier) return { event, tier }
  }
  return null
}

export const OFFER_SOURCE_LABEL: Record<string, string> = {
  BOOKING: "Online booking",
  INTAKE: "Online registration",
  DESK: "Registered at clinic",
  WHATSAPP: "WhatsApp booking",
}
