import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { automationService } from "@/server/services/whatsapp/automation.service"

/**
 * Daily WhatsApp automations (missed appointment, treatment follow-up, 6-month
 * recall) against the LOCAL database. Temporarily approves the three templates,
 * then restores them; queued test messages are cancelled afterwards. No
 * WhatsApp credentials exist locally, so nothing is actually sent.
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const DAY = 86_400_000
const stamp = Date.now().toString().slice(-6)
const KEYS = ["MISSED_APPOINTMENT", "VISIT_FEEDBACK", "DENTAL_RECALL"] as const
const p = {
  missed: "",
  missedButVisited: "",
  followUp: "",
  recall: "",
  recallBooked: "",
  noConsent: "",
}
let savedTemplates: { triggerKey: string | null; status: string; isEnabled: boolean }[] = []
let savedSending: boolean | null = null

test.describe.configure({ mode: "serial" })

const sentTo = async (triggerKey: string, patientId: string) =>
  prisma.whatsAppMessage.count({ where: { triggerKey, patientId, status: { not: "CANCELLED" } } })

test.beforeAll(async () => {
  savedTemplates = await prisma.whatsAppTemplate.findMany({
    where: { triggerKey: { in: [...KEYS] } },
    select: { triggerKey: true, status: true, isEnabled: true },
  })
  expect(savedTemplates.length, "default templates exist locally").toBe(3)
  await prisma.whatsAppTemplate.updateMany({
    where: { triggerKey: { in: [...KEYS] } },
    data: { status: "APPROVED", isEnabled: true },
  })
  const settings = await prisma.whatsAppSettings.findFirst()
  if (settings) {
    savedSending = settings.sendingEnabled
    await prisma.whatsAppSettings.update({
      where: { id: settings.id },
      data: { sendingEnabled: true },
    })
  }

  const reception = await prisma.user.findFirstOrThrow({
    where: { email: "reception.outram@toothfully.in" },
  })
  const doctor = await prisma.user.findFirstOrThrow({
    where: { email: "dr.jashwant@toothfully.in" },
  })
  let n = 0
  const mk = async (label: string, consent = true) => {
    n++
    const pt = await patientService.createWithHistory(
      {
        registrationBranchId: OUTRAM,
        fullName: `E2E Auto ${label} ${stamp}`,
        dateOfBirth: "1990-01-01",
        gender: "MALE",
        mobile: `94${stamp}${String(n).padStart(2, "0")}`,
        email: `auto${stamp}${n}@example.com`,
        address: "E2E",
        leadSource: "",
        referenceName: "",
        reasonForVisit: "",
      } as any,
      { consentGiven: true } as any,
      reception.id
    )
    await prisma.whatsAppConsent.upsert({
      where: { patientId: pt.id },
      create: { patientId: pt.id, consented: consent, consentAt: new Date() },
      update: { consented: consent, revokedAt: null },
    })
    return pt.id
  }
  const visit = (
    patientId: string,
    at: Date,
    visitType: "TREATMENT_SESSION" | "CONSULTATION" = "TREATMENT_SESSION"
  ) =>
    prisma.patientVisit.create({
      data: {
        visitNo: `E2E${stamp}${++n}`,
        patientId,
        branchId: OUTRAM,
        doctorId: doctor.id,
        visitType,
        visitDate: at,
        status: "COMPLETED",
        createdById: reception.id,
      },
    })
  const appt = (patientId: string, at: Date) =>
    prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.id,
        branchId: OUTRAM,
        scheduledAt: at,
        reason: "E2E auto",
        createdById: reception.id,
      },
    })

  const now = Date.now()
  p.missed = await mk("Missed")
  await appt(p.missed, new Date(now - 30 * 60_000))
  p.missedButVisited = await mk("Visited")
  await appt(p.missedButVisited, new Date(now - 30 * 60_000))
  await visit(p.missedButVisited, new Date(now - 10 * 60_000), "CONSULTATION")
  p.followUp = await mk("FollowUp")
  await visit(p.followUp, new Date(now - DAY))
  p.recall = await mk("Recall")
  await visit(p.recall, new Date(now - 200 * DAY))
  p.recallBooked = await mk("RecallBooked")
  await visit(p.recallBooked, new Date(now - 200 * DAY))
  await appt(p.recallBooked, new Date(now + 7 * DAY))
  p.noConsent = await mk("NoConsent", false)
  await appt(p.noConsent, new Date(now - 30 * 60_000))
})

test.afterAll(async () => {
  await prisma.whatsAppMessage.updateMany({
    where: { patientId: { in: Object.values(p).filter(Boolean) }, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })
  for (const t of savedTemplates)
    await prisma.whatsAppTemplate.updateMany({
      where: { triggerKey: t.triggerKey },
      data: { status: t.status as any, isEnabled: t.isEnabled },
    })
  if (savedSending !== null)
    await prisma.whatsAppSettings.updateMany({ data: { sendingEnabled: savedSending } })
  await prisma.$disconnect()
})

test("missed appointment: messages the no-show, not the one who came or has no consent", async () => {
  await automationService.missedAppointments()
  expect(await sentTo("MISSED_APPOINTMENT", p.missed)).toBe(1)
  expect(await sentTo("MISSED_APPOINTMENT", p.missedButVisited)).toBe(0)
  expect(await sentTo("MISSED_APPOINTMENT", p.noConsent)).toBe(0)
  const msg = await prisma.whatsAppMessage.findFirstOrThrow({
    where: { triggerKey: "MISSED_APPOINTMENT", patientId: p.missed },
  })
  expect((msg.variables as string[])[0]).toBe("E2E")
})

test("treatment follow-up: yesterday's treatment gets the check-in", async () => {
  await automationService.treatmentFollowUps()
  expect(await sentTo("VISIT_FEEDBACK", p.followUp)).toBe(1)
})

test("6-month recall: due patient yes, already-booked patient no", async () => {
  await automationService.dentalRecalls()
  expect(await sentTo("DENTAL_RECALL", p.recall)).toBe(1)
  expect(await sentTo("DENTAL_RECALL", p.recallBooked)).toBe(0)
  const msg = await prisma.whatsAppMessage.findFirstOrThrow({
    where: { triggerKey: "DENTAL_RECALL", patientId: p.recall },
  })
  expect((msg.variables as string[])[1]).toBe("7")
})

test("running the jobs again sends no duplicates", async () => {
  await automationService.missedAppointments()
  await automationService.treatmentFollowUps()
  await automationService.dentalRecalls()
  expect(await sentTo("MISSED_APPOINTMENT", p.missed)).toBe(1)
  expect(await sentTo("VISIT_FEEDBACK", p.followUp)).toBe(1)
  expect(await sentTo("DENTAL_RECALL", p.recall)).toBe(1)
})

test("jobs stay off while templates aren't approved", async () => {
  await prisma.whatsAppTemplate.updateMany({
    where: { triggerKey: { in: [...KEYS] } },
    data: { status: "DRAFT" },
  })
  expect(await automationService.missedAppointments()).toEqual({ off: "template not approved" })
  expect(await automationService.dentalRecalls()).toEqual({ off: "template not approved" })
})
