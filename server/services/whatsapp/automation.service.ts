import { prisma } from "@/lib/prisma"
import { istDayKey, istDayRange, fmtIstDate } from "@/lib/ist"
import { WHATSAPP_TRIGGERS, type WhatsAppTriggerKey } from "@/lib/whatsapp/templates"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"

/**
 * Automatic patient messages, run by the daily cron (9 PM IST):
 *  - missed appointment (today's appointments with no visit)
 *  - treatment follow-up (yesterday's treatment sessions → visit_feedback)
 *  - 6-month dental recall
 * Each job runs only once its template is APPROVED by Meta and enabled, so
 * nothing is queued while a template is still draft/pending. Consent is
 * enforced by the queue.
 */

const DAY = 24 * 60 * 60 * 1000
const RECALL_BATCH = 40 // ponytail: fixed cap spreads the first backlog over days; tune if needed

type JobResult = { sent: number; skipped: number } | { off: string }

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || full

async function templateLive(triggerKey: WhatsAppTriggerKey): Promise<boolean> {
  const t = await prisma.whatsAppTemplate.findUnique({
    where: { triggerKey },
    select: { status: true, isEnabled: true },
  })
  return Boolean(t?.isEnabled && t.status === "APPROVED")
}

/** Patients who already got this trigger since `since` — the dedupe set. */
async function alreadySent(triggerKey: string, patientIds: string[], since: Date) {
  if (!patientIds.length) return new Set<string>()
  const rows = await prisma.whatsAppMessage.findMany({
    where: { triggerKey, patientId: { in: patientIds }, createdAt: { gte: since }, status: { not: "CANCELLED" } },
    select: { patientId: true },
  })
  return new Set(rows.map((r) => r.patientId!))
}

async function send(
  triggerKey: WhatsAppTriggerKey,
  items: { patientId: string; branchId?: string; variables: string[] }[],
  skipConsultationGate = false
) {
  let sent = 0
  let skipped = 0
  for (const it of items) {
    const r = await whatsappService.sendTrigger({ triggerKey, ...it, skipConsultationGate })
    if (r.queued) sent++
    else skipped++
  }
  return { sent, skipped }
}

/** Pure selection for recall: drop excluded, oldest first, capped batch. */
export function pickRecalls(
  lastVisits: { patientId: string; last: Date }[],
  exclude: Set<string>,
  now: Date
) {
  return lastVisits
    .filter((v) => !exclude.has(v.patientId))
    .sort((a, b) => a.last.getTime() - b.last.getTime())
    .slice(0, RECALL_BATCH)
    .map((v) => ({ ...v, months: Math.max(6, Math.round((now.getTime() - v.last.getTime()) / (30.44 * DAY))) }))
}

/** One entry per patient, first occurrence wins. */
function uniqueBy<T extends { patientId: string }>(rows: T[], skip: Set<string>) {
  const seen = new Set(skip)
  return rows.filter((r) => !seen.has(r.patientId) && Boolean(seen.add(r.patientId)))
}

export const automationService = {
  /** Today's appointments (already past their time) where the patient never checked in. */
  async missedAppointments(now = new Date()): Promise<JobResult> {
    const key = WHATSAPP_TRIGGERS.MISSED_APPOINTMENT
    if (!(await templateLive(key))) return { off: "template not approved" }
    const { start } = istDayRange(istDayKey(now))

    const appts = await prisma.appointment.findMany({
      where: { status: { in: ["SCHEDULED", "NO_SHOW"] }, scheduledAt: { gte: start, lt: now } },
      select: { patientId: true, branchId: true, scheduledAt: true, patient: { select: { fullName: true } } },
    })
    const ids = [...new Set(appts.map((a) => a.patientId))]
    const visits = await prisma.patientVisit.findMany({
      where: { patientId: { in: ids }, visitDate: { gte: start }, status: { not: "CANCELLED" } },
      select: { patientId: true },
    })
    const skip = await alreadySent(key, ids, start)
    visits.forEach((v) => skip.add(v.patientId))

    const items = uniqueBy(appts, skip).map((a) => ({
      patientId: a.patientId,
      branchId: a.branchId,
      variables: [firstName(a.patient.fullName), fmtIstDate(a.scheduledAt)],
    }))
    // Booked appointment = reason enough to message (same as reminders).
    return send(key, items, true)
  },

  /** Day-after check-in for yesterday's treatment sessions (once per patient per 30 days). */
  async treatmentFollowUps(now = new Date()): Promise<JobResult> {
    const key = WHATSAPP_TRIGGERS.VISIT_FEEDBACK
    if (!(await templateLive(key))) return { off: "template not approved" }
    const { start, end } = istDayRange(istDayKey(new Date(now.getTime() - DAY)))

    const visits = await prisma.patientVisit.findMany({
      where: { visitType: "TREATMENT_SESSION", status: { not: "CANCELLED" }, visitDate: { gte: start, lte: end } },
      select: { patientId: true, branchId: true, patient: { select: { fullName: true } } },
    })
    const ids = [...new Set(visits.map((v) => v.patientId))]
    const skip = await alreadySent(key, ids, new Date(now.getTime() - 30 * DAY))
    const items = uniqueBy(visits, skip).map((v) => ({
      patientId: v.patientId,
      branchId: v.branchId,
      variables: [firstName(v.patient.fullName)],
    }))
    return send(key, items)
  },

  /** Patients last seen 6–12 months ago, nothing booked, no recall in 150 days. */
  async dentalRecalls(now = new Date()): Promise<JobResult> {
    const key = WHATSAPP_TRIGGERS.DENTAL_RECALL
    if (!(await templateLive(key))) return { off: "template not approved" }
    const sixMonths = new Date(now.getTime() - 182 * DAY)
    const twelveMonths = new Date(now.getTime() - 365 * DAY)

    const groups = await prisma.patientVisit.groupBy({
      by: ["patientId"],
      where: { status: { not: "CANCELLED" } },
      _max: { visitDate: true },
      having: { visitDate: { _max: { gte: twelveMonths, lte: sixMonths } } },
    })
    const lastVisits = groups.map((g) => ({ patientId: g.patientId, last: g._max.visitDate! }))
    const ids = lastVisits.map((v) => v.patientId)

    const [booked, deleted, skip] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: { in: ids }, status: "SCHEDULED", scheduledAt: { gte: now } },
        select: { patientId: true },
      }),
      prisma.patient.findMany({ where: { id: { in: ids }, isDeleted: true }, select: { id: true } }),
      alreadySent(key, ids, new Date(now.getTime() - 150 * DAY)),
    ])
    booked.forEach((b) => skip.add(b.patientId))
    deleted.forEach((d) => skip.add(d.id))

    const picks = pickRecalls(lastVisits, skip, now)
    const names = new Map(
      (
        await prisma.patient.findMany({
          where: { id: { in: picks.map((p) => p.patientId) } },
          select: { id: true, fullName: true },
        })
      ).map((p) => [p.id, p.fullName])
    )
    return send(
      key,
      picks.map((p) => ({
        patientId: p.patientId,
        variables: [firstName(names.get(p.patientId) ?? "there"), String(p.months)],
      }))
    )
  },
}
