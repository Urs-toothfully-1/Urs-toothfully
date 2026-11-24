/**
 * Referral WhatsApp messages: both patients are messaged when a referral is
 * recorded, and again (with their new balance) on the new patient's first payment.
 * Plus invite-link bookings: consent saved before the referral, mobiles matched on
 * the last 10 digits, and existing paying patients not recorded as referred.
 *
 * LOCAL database only (creates test patients, queues — but cannot send — messages):
 *   npx dotenvx run -f .env.local -- npx tsx qa/check-referral-whatsapp.ts
 */
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { paymentService } from "@/server/services/payment.service"
import { referralService } from "@/server/services/referral.service"
import { templateService } from "@/server/services/whatsapp/template.service"
import { appointmentRequestService } from "@/server/services/appointment-request.service"

const OUTRAM = "branch-outram-0000-0000-000000000001"
const stamp = String(Date.now()).slice(-6)
let failed = 0
const check = (label: string, ok: boolean, got?: unknown) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`, ok ? "" : JSON.stringify(got))
  if (!ok) failed++
}

async function patient(name: string, mobile: string, userId: string) {
  const p = await patientService.createWithHistory(
    {
      registrationBranchId: OUTRAM,
      fullName: name,
      dateOfBirth: "1990-01-01",
      gender: "FEMALE",
      mobile,
      email: `wa${stamp}${mobile.slice(-2)}@example.com`,
      address: "1 QA Road",
      leadSource: "",
      referenceName: "",
      reasonForVisit: "",
    } as any,
    { consentGiven: true } as any,
    userId
  )
  await prisma.whatsAppConsent.upsert({
    where: { patientId: p.id },
    create: { patientId: p.id, consented: true, consentAt: new Date() },
    update: { consented: true, revokedAt: null },
  })
  return p
}

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
  const reception = await prisma.user.findFirstOrThrow({
    where: { role: "RECEPTIONIST", branchId: OUTRAM },
  })
  await templateService.ensureDefaults(admin.id)
  check(
    "4 referral templates installed",
    (await prisma.whatsAppTemplate.count({
      where: { triggerKey: { startsWith: "REFERRAL_" } },
    })) === 4
  )

  const referrer = await patient("Asha Referrer", `96${stamp}11`, reception.id)
  const friend = await patient("Ravi Friend", `96${stamp}12`, reception.id)
  await referralService.linkReferrer({
    refereeId: friend.id,
    referrerId: referrer.id,
    userId: reception.id,
  })

  const msgs = (key: string) =>
    prisma.whatsAppMessage.findMany({
      where: { triggerKey: key, patientId: { in: [referrer.id, friend.id] } },
    })
  const rec1 = await msgs("REFERRAL_RECORDED_REFERRER")
  const rec2 = await msgs("REFERRAL_RECORDED_REFEREE")
  check(
    "referrer messaged when referral recorded",
    rec1.length === 1 && rec1[0].patientId === referrer.id,
    rec1
  )
  check(
    "new patient messaged when referral recorded",
    rec2.length === 1 && rec2[0].patientId === friend.id,
    rec2
  )
  check(
    "recorded message names the friend and 500 points",
    JSON.stringify(rec1[0]?.variables) === JSON.stringify(["Asha", "Ravi", "500"]),
    rec1[0]?.variables
  )

  const fee = await paymentService.getConsultationFee(OUTRAM)
  await paymentService.create(
    {
      paymentType: "CONSULTATION",
      patientId: friend.id,
      branchId: OUTRAM,
      amount: fee,
      mode: "CASH",
    } as any,
    reception.id
  )
  await paymentService.create(
    {
      paymentType: "CONSULTATION",
      patientId: friend.id,
      branchId: OUTRAM,
      amount: fee,
      mode: "CASH",
    } as any,
    reception.id
  )

  const pts1 = await msgs("REFERRAL_POINTS_REFERRER")
  const pts2 = await msgs("REFERRAL_POINTS_REFEREE")
  check(
    "referrer gets +500 message with balance (once, even after 2 payments)",
    pts1.length === 1 &&
      JSON.stringify(pts1[0].variables) === JSON.stringify(["Asha", "Ravi", "500", "500"]),
    pts1.map((m) => m.variables)
  )
  check(
    "new patient gets +500 message with balance (once)",
    pts2.length === 1 &&
      JSON.stringify(pts2[0].variables) === JSON.stringify(["Ravi", "500", "500"]),
    pts2.map((m) => m.variables)
  )

  // ── Booking from a friend's /rewards link, confirmed by reception ──
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR", isActive: true } })
  await referralService.ensureCode(referrer.id)
  const code = (await prisma.patient.findUniqueOrThrow({ where: { id: referrer.id } }))
    .referralCode!
  let slot = 0
  const book = async (fullName: string, mobile: string) => {
    const req = await prisma.appointmentRequest.create({
      data: {
        branchId: OUTRAM,
        fullName,
        mobile,
        preferredDate: new Date(),
        referralCode: code,
        whatsappConsent: true,
      },
    })
    const at = new Date(Date.now() + (3 + (Number(stamp) % 50)) * 86_400_000)
    at.setUTCHours(5 + slot++, 0, 0, 0)
    await appointmentRequestService.confirm(
      req.id,
      { doctorId: doctor.id, scheduledAt: at },
      reception.id
    )
  }

  // New person, consent ticked on the form → referred AND gets the referral WhatsApp.
  const newMobile = `95${stamp}21`
  await book("Neha Invitee", newMobile)
  const neha = await prisma.patient.findFirstOrThrow({
    where: { mobile: newMobile },
    select: { id: true, referredBy: { select: { referrerId: true } } },
  })
  check("invite booking links the referrer", neha.referredBy?.referrerId === referrer.id, neha)
  check(
    "new patient gets the 'you were referred' WhatsApp (consent saved first)",
    (await prisma.whatsAppMessage.count({
      where: { patientId: neha.id, triggerKey: "REFERRAL_RECORDED_REFEREE" },
    })) === 1
  )

  // Existing paying patient books with a 0-prefixed number → same record, no referral.
  const regular = await patient("Old Regular", `95${stamp}22`, reception.id)
  await paymentService.create(
    {
      paymentType: "CONSULTATION",
      patientId: regular.id,
      branchId: OUTRAM,
      amount: fee,
      mode: "CASH",
    } as any,
    reception.id
  )
  await book("Old Regular", `0${regular.mobile}`)
  check(
    "'0'-prefixed mobile finds the existing patient (no duplicate)",
    (await prisma.patient.count({ where: { mobile: { endsWith: regular.mobile } } })) === 1
  )
  check(
    "an already-paying patient isn't recorded as referred",
    !(await prisma.referral.findUnique({ where: { refereeId: regular.id } }))
  )

  console.log(failed ? `\n${failed} failed` : "\nall passed")
  await prisma.$disconnect()
  process.exit(failed ? 1 : 0)
}
main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
