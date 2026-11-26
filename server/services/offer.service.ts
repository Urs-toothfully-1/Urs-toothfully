import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { liveOffer, parseTiers, tierAt, type OfferTier } from "@/lib/offers"
import { istDayRange, istTodayStr } from "@/lib/ist"
import type { Prisma } from "@prisma/client"

export type OfferSource = "BOOKING" | "INTAKE" | "DESK" | "WHATSAPP"

type Db = Prisma.TransactionClient | typeof prisma

const last10 = (m: string) => m.replace(/\D/g, "").slice(-10)

/** Active events whose window covers `at` (cheap: a handful of rows). */
async function candidateEvents(db: Db, at: Date) {
  const rows = await db.offerEvent.findMany({
    where: { isActive: true, startsAt: { lte: at }, endsAt: { gt: at } },
    orderBy: { startsAt: "asc" },
  })
  return rows.map((r) => ({ ...r, tiers: parseTiers(r.tiers) }))
}

/** Places taken per event, grouped by tier, oldest first. */
async function claimTimes(db: Db, eventIds: string[]): Promise<Map<string, Date[][]>> {
  const out = new Map<string, Date[][]>()
  if (eventIds.length === 0) return out
  const rows = await db.offerClaim.findMany({
    where: { eventId: { in: eventIds } },
    select: { eventId: true, tierIndex: true, at: true },
    orderBy: { at: "asc" },
  })
  for (const r of rows) {
    const byTier = out.get(r.eventId) ?? []
    ;(byTier[r.tierIndex] ??= []).push(r.at)
    out.set(r.eventId, byTier)
  }
  return out
}

export type Claimant = {
  name: string
  mobile: string
  source: OfferSource
  /** Online booking not yet confirmed. */
  requestId?: string
  /** Patient record, when it exists. */
  patientId?: string
}

export const offerService = {
  /**
   * The offer live now, with its event and places left. A promotion must never
   * break booking: any failure means "no offer".
   */
  async live(at = new Date()) {
    try {
      const events = await candidateEvents(prisma, at)
      const claims = await claimTimes(
        prisma,
        events.map((e) => e.id)
      )
      return liveOffer(events, at, (e) => claims.get(e.id) ?? [])
    } catch (err) {
      console.error("[offers] live lookup failed:", err)
      return null
    }
  },

  /**
   * Takes this person's place in the live event and logs it (the event's
   * booking log). One place per person per event: a second booking or a later
   * registration links to the same entry. Locked per event so "first 100" is
   * exact even when two people submit in the same second. Never throws.
   */
  async claim(c: Claimant): Promise<{ claimId: string; eventName: string; offer: string } | null> {
    const mobile = last10(c.mobile)
    if (mobile.length !== 10) return null
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date()
        for (const e of await candidateEvents(tx, now)) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"offer:" + e.id}))`

          let row = await tx.offerClaim.findFirst({ where: { eventId: e.id, mobile } })
          if (row) {
            // Already in this event: just link what we now know about them.
            if ((c.requestId && !row.requestId) || (c.patientId && !row.patientId))
              row = await tx.offerClaim.update({
                where: { id: row.id },
                data: {
                  ...(c.requestId && !row.requestId && { requestId: c.requestId }),
                  ...(c.patientId && !row.patientId && { patientId: c.patientId }),
                },
              })
          } else {
            const hit = tierAt(e, now, (await claimTimes(tx, [e.id])).get(e.id) ?? [])
            if (!hit) continue
            row = await tx.offerClaim.create({
              data: {
                eventId: e.id,
                tierIndex: hit.index,
                offer: hit.offer,
                at: now,
                source: c.source,
                name: c.name.trim().slice(0, 200),
                mobile,
                requestId: c.requestId,
                patientId: c.patientId,
              },
            })
          }
          if (row.patientId)
            await tx.patientOffer.upsert({
              where: { patientId_eventId: { patientId: row.patientId, eventId: e.id } },
              create: {
                patientId: row.patientId,
                eventId: e.id,
                offer: row.offer,
                qualifiedAt: row.at,
                source: row.source,
              },
              update: {},
            })
          return { claimId: row.id, eventName: e.name, offer: row.offer }
        }
        return null
      })
    } catch (err) {
      console.error("[offers] claim failed:", err)
      return null
    }
  },

  /**
   * Reception confirmed an online booking: attach the patient to the place the
   * booking took (at submit time) and record the offer they're owed.
   */
  async attachPatient(requestId: string, patientId: string) {
    try {
      const row = await prisma.offerClaim.findUnique({ where: { requestId } })
      if (!row) return
      await prisma.$transaction([
        prisma.offerClaim.update({ where: { id: row.id }, data: { patientId } }),
        prisma.patientOffer.upsert({
          where: { patientId_eventId: { patientId, eventId: row.eventId } },
          create: { patientId, eventId: row.eventId, offer: row.offer, qualifiedAt: row.at, source: row.source },
          update: {},
        }),
      ])
    } catch (err) {
      console.error("[offers] attachPatient failed:", err)
    }
  },

  /** The offer each online booking request took, for the request inbox. */
  async offersForRequests(requestIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (requestIds.length === 0) return out
    const rows = await prisma.offerClaim
      .findMany({
        where: { requestId: { in: requestIds } },
        select: { requestId: true, offer: true, event: { select: { name: true } } },
      })
      .catch(() => []) // never break the appointments page over a promotion
    for (const r of rows) if (r.requestId) out.set(r.requestId, `${r.event.name}: ${r.offer}`)
    return out
  },

  /** A claim's offer, for the booking thank-you page. */
  async claimById(id: string) {
    return prisma.offerClaim
      .findUnique({ where: { id }, select: { offer: true, event: { select: { name: true } } } })
      .catch(() => null)
  },

  async listEvents() {
    const rows = await prisma.offerEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 20,
      include: {
        claims: { orderBy: { at: "asc" } },
        patientOffers: { select: { id: true, patientId: true, givenAt: true, givenBy: { select: { name: true } } } },
      },
    })
    return rows.map((r) => ({ ...r, tiers: parseTiers(r.tiers) }))
  },

  async create(
    input: {
      name: string
      startsAt: Date
      endsAt: Date
      tiers: OfferTier[]
      terms?: string | null
    },
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
      newValues: {
        name: event.name,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        tiers: input.tiers,
      },
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
    await prisma.offerEvent.update({
      where: { id },
      data: { startsAt: now, endsAt, isActive: true },
    })
    await createAuditLog({
      entityType: "OfferEvent",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      previousValues: { startsAt: event.startsAt },
      newValues: { startsAt: now, endsAt, startedNow: true },
    })
  },

  /** Offers not yet given, per patient — shown on their appointment cards. */
  async openByPatient(patientIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (patientIds.length === 0) return out
    const rows = await prisma.patientOffer
      .findMany({
        where: { patientId: { in: [...new Set(patientIds)] }, givenAt: null },
        select: { patientId: true, offer: true, event: { select: { name: true } } },
      })
      .catch(() => []) // never break the appointments page over a promotion
    for (const r of rows) out.set(r.patientId, [...(out.get(r.patientId) ?? []), `${r.event.name}: ${r.offer}`])
    return out
  },

  /** Deletes an event and the offer tags it gave patients (e.g. a test run). */
  async remove(id: string, changedById: string) {
    const event = await prisma.offerEvent.delete({ where: { id } })
    await createAuditLog({
      entityType: "OfferEvent",
      entityId: id,
      action: "DELETE",
      changedById,
      previousValues: { name: event.name, startsAt: event.startsAt, endsAt: event.endsAt },
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
      data: given
        ? { givenAt: new Date(), givenById: changedById }
        : { givenAt: null, givenById: null },
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
