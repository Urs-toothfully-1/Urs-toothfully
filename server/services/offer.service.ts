import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { liveOffer, parseTiers, tierAt, type OfferTier } from "@/lib/offers"
import { istDayRange, istTodayStr } from "@/lib/ist"
import type { Prisma } from "@prisma/client"

export type OfferSource = "BOOKING" | "INTAKE" | "DESK" | "WHATSAPP"

/** Events that may be live around `at` (cheap: a handful of rows). */
async function candidateEvents(at: Date) {
  const rows = await prisma.offerEvent.findMany({
    where: { isActive: true, startsAt: { lte: at }, endsAt: { gt: at } },
    orderBy: { startsAt: "asc" },
  })
  return rows.map((r) => ({ ...r, tiers: parseTiers(r.tiers) }))
}

export const offerService = {
  /**
   * The offer live at `at` (default now), with its event. A promotion must never
   * break booking: any failure means "no offer".
   */
  async live(at = new Date()) {
    try {
      return liveOffer(await candidateEvents(at), at)
    } catch (err) {
      console.error("[offers] live lookup failed:", err)
      return null
    }
  },

  /** Offers for many past moments at once (e.g. the booking-request inbox). */
  async offersFor(times: Date[]): Promise<(string | null)[]> {
    if (times.length === 0) return []
    const min = new Date(Math.min(...times.map((t) => t.getTime())))
    const rows = await prisma.offerEvent
      .findMany({ where: { isActive: true, endsAt: { gt: min } } })
      .catch(() => []) // never break the appointments page over a promotion
    const events = rows.map((r) => ({ ...r, tiers: parseTiers(r.tiers) }))
    return times.map((t) => {
      const hit = liveOffer(events, t)
      return hit ? `${hit.event.name}: ${hit.tier.offer}` : null
    })
  },

  /**
   * Tags a patient with the offer live at `at` (when they booked/registered).
   * First qualification per event wins. Never throws into the caller's flow.
   */
  async qualify(patientId: string, at: Date, source: OfferSource) {
    try {
      const hit = await offerService.live(at)
      if (!hit) return null
      await prisma.patientOffer.upsert({
        where: { patientId_eventId: { patientId, eventId: hit.event.id } },
        create: { patientId, eventId: hit.event.id, offer: hit.tier.offer, qualifiedAt: at, source },
        update: {},
      })
      return hit
    } catch (err) {
      console.error("[offers] qualify failed:", err)
      return null
    }
  },

  async listEvents() {
    const rows = await prisma.offerEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 20,
      include: {
        patientOffers: {
          orderBy: { qualifiedAt: "asc" },
          include: {
            patient: { select: { id: true, fullName: true, patientId: true, mobile: true } },
            givenBy: { select: { name: true } },
          },
        },
      },
    })
    return rows.map((r) => ({ ...r, tiers: parseTiers(r.tiers) }))
  },

  /** Booking requests made during an event that reception hasn't confirmed yet. */
  async pendingRequests(event: { startsAt: Date; endsAt: Date; tiers: OfferTier[]; isActive: boolean }) {
    const rows = await prisma.appointmentRequest.findMany({
      where: { status: "PENDING", createdAt: { gte: event.startsAt, lt: event.endsAt } },
      orderBy: { createdAt: "asc" },
      select: { id: true, fullName: true, mobile: true, createdAt: true },
    })
    return rows
      .map((r) => ({ ...r, offer: tierAt({ ...event, isActive: true }, r.createdAt)?.offer ?? null }))
      .filter((r) => r.offer)
  },

  async create(
    input: { name: string; startsAt: Date; endsAt: Date; tiers: OfferTier[]; terms?: string | null },
    createdById: string
  ) {
    if (!input.name.trim()) throw new Error("Give the event a name.")
    if (input.endsAt <= input.startsAt) throw new Error("The end must be after the start.")
    if (input.tiers.length === 0) throw new Error("Add at least one offer.")
    const event = await prisma.offerEvent.create({
      data: {
        name: input.name.trim().slice(0, 120),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        tiers: input.tiers as unknown as Prisma.InputJsonValue,
        terms: input.terms?.trim().slice(0, 1000) || null,
        createdById,
      },
    })
    await createAuditLog({
      entityType: "OfferEvent",
      entityId: event.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, tiers: input.tiers },
    })
    return event
  },

  /**
   * Starts the countdown now (e.g. the moment the flyer is posted). An end time
   * that has already passed (event saved the night before) moves to the end of
   * today, so "Start now" always works on the day.
   */
  async startNow(id: string, changedById: string) {
    const event = await prisma.offerEvent.findUnique({ where: { id } })
    if (!event) throw new Error("Event not found")
    const now = new Date()
    const endsAt = event.endsAt > now ? event.endsAt : istDayRange(istTodayStr()).end
    await prisma.offerEvent.update({ where: { id }, data: { startsAt: now, endsAt, isActive: true } })
    await createAuditLog({
      entityType: "OfferEvent",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      previousValues: { startsAt: event.startsAt },
      newValues: { startsAt: now, endsAt, startedNow: true },
    })
  },

  async setActive(id: string, isActive: boolean, changedById: string) {
    await prisma.offerEvent.update({ where: { id }, data: { isActive } })
    await createAuditLog({
      entityType: "OfferEvent",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      newValues: { isActive },
    })
  },

  /** A patient's event offers (given or not), for the profile header. */
  async forPatient(patientId: string) {
    return prisma.patientOffer
      .findMany({
        where: { patientId },
        orderBy: { qualifiedAt: "desc" },
        include: { event: { select: { name: true } }, givenBy: { select: { name: true } } },
      })
      .catch(() => []) // never break the patient profile over a promotion
  },

  async markGiven(id: string, given: boolean, changedById: string) {
    const row = await prisma.patientOffer.update({
      where: { id },
      data: given ? { givenAt: new Date(), givenById: changedById } : { givenAt: null, givenById: null },
    })
    await createAuditLog({
      entityType: "PatientOffer",
      entityId: id,
      action: "UPDATE",
      changedById,
      newValues: { given, offer: row.offer },
    })
    return row
  },
}
