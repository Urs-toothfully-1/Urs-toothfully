/**
 * Workflow check for the quote → payment options → treatment invoice flow and
 * the referral program, through the real service layer.
 *
 * Run against a LOCAL database only (creates test patients):
 *   npx dotenvx run -f .env.local -- npx tsx qa/check-invoice-referral-flow.ts
 */
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { queueService } from "@/server/services/queue.service"
import { estimateService } from "@/server/services/estimate.service"
import { paymentService } from "@/server/services/payment.service"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { invoiceService } from "@/server/services/invoice.service"
import { referralService } from "@/server/services/referral.service"
import { rewardService } from "@/server/services/reward.service"
import { appointmentRequestService } from "@/server/services/appointment-request.service"
import { getPatientBalance } from "@/server/services/patient-summary.service"
import { getOutstandingBalances } from "@/lib/reports/outstanding-balances"

const OUTRAM = "branch-outram-0000-0000-000000000001"

let passed = 0
const failures: string[] = []
function check(label: string, ok: boolean | undefined, got?: unknown) {
  if (ok) { passed++; console.log(`  ✓ ${label}`) }
  else { failures.push(`${label}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ""}`); console.log(`  ✗ ${label}`, got ?? "") }
}
async function expectThrows(label: string, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "no error") } catch { check(label, true) }
}

const stamp = Date.now().toString().slice(-6)
let n = 0
async function newPatient(name: string, mobile: string, userId: string) {
  return patientService.createWithHistory(
    {
      registrationBranchId: OUTRAM, fullName: name, dateOfBirth: "1990-01-01", gender: "FEMALE",
      mobile, email: `qa${stamp}${n++}@example.com`, address: "1 QA Road", leadSource: "", referenceName: "", reasonForVisit: "",
    } as any,
    { consentGiven: true } as any,
    userId
  )
}
async function visitFor(patientId: string, receptionId: string, doctorId: string) {
  const fee = await paymentService.getConsultationFee(OUTRAM)
  await paymentService.create({ paymentType: "CONSULTATION", patientId, branchId: OUTRAM, amount: fee, mode: "CASH" } as any, receptionId)
  const { visit } = await queueService.addToQueue(
    { patientId, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "QA", doctorId },
    receptionId
  )
  return visit
}

async function main() {
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" } })
  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", branchId: OUTRAM } })
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })

  console.log("\n── Referral codes & lookup")
  const referrer = await newPatient("QA Referrer", `97${stamp}01`, reception.id)
  check("every new patient gets a 6-char referral code", /^[A-Z2-9]{6}$/.test(referrer.referralCode ?? ""), referrer.referralCode)
  const byMobile = await referralService.findReferrerCandidates(`+91 ${referrer.mobile}`)
  check("referrer found by mobile (with +91 prefix)", byMobile.some((c) => c.id === referrer.id))
  const byCode = await referralService.findReferrerCandidates(referrer.referralCode!.toLowerCase())
  check("referrer found by code (case-insensitive)", byCode.length === 1 && byCode[0].id === referrer.id)
  check("unknown code finds nobody", (await referralService.findReferrerCandidates("ZZZZZZ")).length === 0)
  check("backfill left no patient without a code", (await prisma.patient.count({ where: { referralCode: null } })) === 0)

  const friend = await newPatient("QA Referred Friend", `97${stamp}02`, reception.id)
  await referralService.linkReferrer({ refereeId: friend.id, referrerId: referrer.id, userId: reception.id })
  const rb = (await rewardService.overview(friend.id)).referredBy
  check("'referred by' shows referrer + date", rb?.referrer.id === referrer.id && !!rb.createdAt)
  check("lead source set to Referral", (await prisma.patient.findUnique({ where: { id: friend.id } }))?.leadSource === "Referral")
  await expectThrows("second referrer for the same patient is refused", () =>
    referralService.linkReferrer({ refereeId: friend.id, referrerId: referrer.id, userId: reception.id }))
  await expectThrows("self-referral is refused", () =>
    referralService.linkReferrer({ refereeId: referrer.id, referrerId: referrer.id, userId: reception.id }))
  const ov = await rewardService.overview(referrer.id)
  check("referrer's tab lists who they referred", ov.made.length === 1 && ov.made[0].referee.id === friend.id)

  console.log("\n── Quote with a range")
  const visit = await visitFor(friend.id, reception.id, doctor.id)
  const est = await estimateService.create(
    {
      patientId: friend.id, branchId: OUTRAM, visitId: visit.id,
      items: [
        { treatmentName: "Root Canal", category: "ENDODONTICS", quantity: 1, unitRate: 6000, unitRateMax: 12000, plannedSittings: 3, sortOrder: 0 },
        { treatmentName: "Scaling", category: "PERIODONTICS", quantity: 1, unitRate: 1000, plannedSittings: 1, sortOrder: 1 },
      ],
    } as any,
    doctor.id
  )
  check("new estimate uses invoice billing", est.invoiceBilling === true)
  check("quote min = 7,000", Number(est.total) === 7000, Number(est.total))
  check("quote max = 13,000", Number(est.totalMax) === 13000, Number(est.totalMax))
  let bal = await getPatientBalance(friend.id)
  check("quote is NOT added to pending", bal.outstanding === 0, bal)
  const report = await getOutstandingBalances()
  check("outstanding report ignores un-invoiced quote", !JSON.stringify(report).includes(friend.id))

  console.log("\n── Payment options")
  const sug = await paymentAgreementService.getOrSuggest(est.id)
  check("quote-only estimate has no stage schedule", ((sug.stages as unknown[] | null)?.length ?? 0) === 0)
  check("default payment options offered", sug.options.length === 2, sug.options)
  await paymentAgreementService.save(est.id, [], null, false, null, [
    { title: "Full advance", discountType: "PERCENT", discountValue: 5, splits: [100], note: "" },
    { title: "Full advance (flat)", discountType: "FLAT", discountValue: 1000, splits: [100], note: "" },
    { title: "Pay as you go", discountType: "NONE", discountValue: 0, splits: [], note: "" },
  ])
  check("custom options saved", (await paymentAgreementService.getOrSuggest(est.id)).options.length === 3)

  console.log("\n── Advance, then invoice")
  check("cap before billing = quote max", (await paymentService.getOutstandingByEstimate(est.id)) === 13000)
  await paymentService.create({ paymentType: "ADVANCE", patientId: friend.id, branchId: OUTRAM, estimateId: est.id, amount: 5000, mode: "CASH" } as any, reception.id)
  bal = await getPatientBalance(friend.id)
  check("advance shows as credit, nothing pending", bal.outstanding === 0 && bal.credit === 5000, bal)
  await expectThrows("cannot collect beyond the quote max", () =>
    paymentService.create({ paymentType: "TREATMENT", patientId: friend.id, branchId: OUTRAM, estimateId: est.id, amount: 8001, mode: "CASH" } as any, reception.id))

  const rctItem = est.items.find((i) => i.treatmentName === "Root Canal")!
  const inv = await invoiceService.create({
    estimateId: est.id, visitId: visit.id,
    items: [{ estimateItemId: rctItem.id, treatmentName: "Root Canal", toothNumber: "46", quantity: 1, unitRate: 9000 }],
    discountValue: 0, discountIsPercent: false,
  }, doctor.id)
  check("invoice number INV-YYYY-NNNNN", /^INV-\d{4}-\d{5}$/.test(inv.invoiceNo), inv.invoiceNo)
  bal = await getPatientBalance(friend.id)
  check("after ₹9,000 invoice: ₹4,000 due, no credit", bal.outstanding === 4000 && bal.credit === 0, bal)
  const inv2 = await invoiceService.create({
    estimateId: est.id,
    items: [{ treatmentName: "Extra X-ray (not on quote)", quantity: 1, unitRate: 500 }],
    discountValue: 10, discountIsPercent: true,
  }, doctor.id)
  check("ad-hoc line + 10% discount → ₹450", Number(inv2.total) === 450, Number(inv2.total))
  bal = await getPatientBalance(friend.id)
  check("due = 9,450 − 5,000", bal.outstanding === 4450, bal)
  await paymentService.create({ paymentType: "TREATMENT", patientId: friend.id, branchId: OUTRAM, estimateId: est.id, amount: 4450, mode: "UPI" } as any, reception.id)
  bal = await getPatientBalance(friend.id)
  check("fully paid → nothing due", bal.outstanding === 0 && bal.credit === 0, bal)
  await invoiceService.softDelete(inv2.id, admin.id, "QA: billed by mistake")
  bal = await getPatientBalance(friend.id)
  check("deleting an invoice turns its amount into advance credit", bal.outstanding === 0 && bal.credit === 450, bal)
  await expectThrows("empty invoice refused", () => invoiceService.create({ estimateId: est.id, items: [] }, doctor.id))

  console.log("\n── Legacy estimate unchanged")
  const legacyVisit = await visitFor(friend.id, reception.id, doctor.id)
  const legacy = await estimateService.create(
    { patientId: friend.id, branchId: OUTRAM, visitId: legacyVisit.id, items: [{ treatmentName: "Crown", category: "PROSTHODONTICS", quantity: 1, unitRate: 8000, sortOrder: 0 }] } as any,
    doctor.id
  )
  await prisma.estimate.update({ where: { id: legacy.id }, data: { invoiceBilling: false } })
  bal = await getPatientBalance(friend.id)
  check("legacy estimate total counts as pending", bal.outstanding === 8000, bal)
  check("legacy estimate still gets a stage schedule", (((await paymentAgreementService.getOrSuggest(legacy.id)).stages as unknown[] | null)?.length ?? 0) > 0)
  await expectThrows("legacy estimate can't be invoiced", () =>
    invoiceService.create({ estimateId: legacy.id, items: [{ treatmentName: "Crown", quantity: 1, unitRate: 8000 }] }, doctor.id))

  console.log("\n── Campaigns")
  const admin2 = admin
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  await expectThrows("campaign needs both offers", () =>
    rewardService.createCampaign({ name: "Bad", referrerOffer: "", refereeOffer: "x", referrerKind: "OTHER", refereeKind: "OTHER", startsAt: today }, admin2.id))
  await expectThrows("end date before start is refused", () =>
    rewardService.createCampaign({ name: "Bad dates", referrerOffer: "a", refereeOffer: "b", referrerKind: "OTHER", refereeKind: "OTHER", startsAt: today, endsAt: "2020-01-01" }, admin2.id))
  const camp = await rewardService.createCampaign({
    name: `QA Smiles ${stamp}`, referrerOffer: "₹500 off per friend", refereeOffer: "Free check-up",
    referrerKind: "DISCOUNT_FLAT", referrerValue: 500, refereeKind: "FREE_CHECKUP", refereeValue: null,
    startsAt: "2026-01-01", isActive: true, theme: "gold",
  }, admin2.id)
  check("campaign is live", (await rewardService.liveCampaigns()).some((c) => c.id === camp.id))
  await rewardService.setCampaignActive(camp.id, false, admin2.id)
  check("paused campaign not live", !(await rewardService.liveCampaigns()).some((c) => c.id === camp.id))
  await rewardService.setCampaignActive(camp.id, true, admin2.id)
  const ovRef = await rewardService.overview(friend.id)
  check("referral shows campaigns running on its date", ovRef.referredBy!.campaigns.some((c) => c.id === camp.id))

  console.log("\n── Points: 1 per referral, both sides, never twice")
  const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId: friend.id } })
  check("referral qualified after first payment", referral.status === "QUALIFIED", referral.status)
  const friend2 = await newPatient("QA Friend Two", `97${stamp}03`, reception.id)
  await referralService.linkReferrer({ refereeId: friend2.id, referrerId: referrer.id, userId: reception.id })
  const friend3 = await newPatient("QA Friend Three", `97${stamp}04`, reception.id)
  await referralService.linkReferrer({ refereeId: friend3.id, referrerId: referrer.id, userId: reception.id })
  // friend3 visits (pays) → qualifies; friend2 has not visited.
  await visitFor(friend3.id, reception.id, doctor.id)
  let pts = await rewardService.points(referrer.id)
  check("referrer: 2 points available, 1 pending (friend not visited)", pts.available === 2 && pts.pending === 1, pts)
  check("referred patient has 1 point", (await rewardService.points(friend.id)).available === 1)

  await expectThrows("can't use more points than available", () =>
    rewardService.redeem({ patientId: referrer.id, points: 3, kind: "DISCOUNT_FLAT", value: 1500 }, doctor.id, OUTRAM))
  await expectThrows("discount needs an amount", () =>
    rewardService.redeem({ patientId: referrer.id, points: 1, kind: "DISCOUNT_FLAT", value: 0 }, doctor.id, OUTRAM))
  await expectThrows("free treatment needs a description", () =>
    rewardService.redeem({ patientId: referrer.id, points: 1, kind: "FREE_TREATMENT" }, doctor.id, OUTRAM))

  const disc = await rewardService.redeem({ patientId: referrer.id, points: 2, campaignId: camp.id, kind: "DISCOUNT_FLAT", value: 1000 }, doctor.id, OUTRAM)
  pts = await rewardService.points(referrer.id)
  check("2 points spent → 0 available", pts.available === 0 && pts.used === 2, pts)
  await expectThrows("spent points can't be used again", () =>
    rewardService.redeem({ patientId: referrer.id, points: 1, kind: "FREE_CHECKUP" }, doctor.id, OUTRAM))
  check("referee's own point is untouched", (await rewardService.points(friend.id)).available === 1)

  // Two doctors redeem the referee's single point at the same moment → only one wins.
  const race = await Promise.allSettled([
    rewardService.redeem({ patientId: friend.id, points: 1, kind: "FREE_CHECKUP", markUsedNow: true }, doctor.id, OUTRAM),
    rewardService.redeem({ patientId: friend.id, points: 1, kind: "FREE_CHECKUP", markUsedNow: true }, doctor.id, OUTRAM),
  ])
  check("concurrent redeem of one point: exactly one succeeds", race.filter((r) => r.status === "fulfilled").length === 1, race.map((r) => r.status))
  check("referee point now used", (await rewardService.points(friend.id)).available === 0)

  console.log("\n── Using a discount reward on an invoice")
  check("₹1,000 discount offered in billing", (await rewardService.availableDiscounts(referrer.id)).some((r) => r.id === disc.id && r.value === 1000))
  const rVisit = await visitFor(referrer.id, reception.id, doctor.id)
  const rEst = await estimateService.create(
    { patientId: referrer.id, branchId: OUTRAM, visitId: rVisit.id, items: [{ treatmentName: "Filling", category: "RESTORATIVE", quantity: 1, unitRate: 1500, unitRateMax: 2500, sortOrder: 0 }] } as any,
    doctor.id
  )
  await expectThrows("someone else's reward can't be used", () =>
    invoiceService.create({ estimateId: est.id, items: [{ treatmentName: "X", quantity: 1, unitRate: 100 }], redeemRewardId: disc.id }, doctor.id))
  const rInv = await invoiceService.create({
    estimateId: rEst.id, items: [{ treatmentName: "Filling", quantity: 1, unitRate: 2000 }],
    discountValue: 1000, discountIsPercent: false, redeemRewardId: disc.id,
  }, doctor.id)
  check("invoice with ₹1,000 reward = ₹1,000", Number(rInv.total) === 1000, Number(rInv.total))
  check("reward marked used on the invoice", (await prisma.referralRedemption.findUnique({ where: { id: disc.id } }))?.invoiceId === rInv.id)
  await expectThrows("same reward can't go on a second invoice", () =>
    invoiceService.create({ estimateId: rEst.id, items: [{ treatmentName: "X", quantity: 1, unitRate: 100 }], redeemRewardId: disc.id }, doctor.id))
  await invoiceService.softDelete(rInv.id, admin.id, "QA: undo")
  check("deleting the invoice returns the reward", (await rewardService.availableDiscounts(referrer.id)).some((r) => r.id === disc.id))
  await expectThrows("unused reward with campaign blocks campaign delete", () => rewardService.deleteCampaign(camp.id, admin2.id))
  await rewardService.cancelRedemption(disc.id, doctor.id)
  check("cancelling a reward gives its points back", (await rewardService.points(referrer.id)).available === 2)
  await rewardService.deleteCampaign(camp.id, admin2.id)
  check("unused campaign can be deleted", !(await prisma.rewardCampaign.findUnique({ where: { id: camp.id } })))

  console.log("\n── Booking from a /rewards invite link")
  const reqMobile = `95${stamp}77`
  const req = await prisma.appointmentRequest.create({
    data: { branchId: OUTRAM, fullName: "QA Invitee", mobile: reqMobile, preferredDate: new Date(), referralCode: referrer.referralCode },
  })
  // A slot unique to this run, so repeated runs don't collide on the same doctor/time.
  const tomorrow = new Date(Date.now() + (2 + (Number(stamp) % 60)) * 86_400_000); tomorrow.setUTCHours(4 + (Number(stamp) % 8), (Number(stamp) % 2) * 30, 0, 0)
  await appointmentRequestService.confirm(req.id, { doctorId: doctor.id, scheduledAt: tomorrow }, reception.id).catch((e) => check(`confirm request (${e.message})`, false))
  const invitee = await prisma.patient.findFirst({ where: { mobile: reqMobile }, select: { id: true, leadSource: true, referredBy: { select: { referrerId: true } } } })
  check("confirmed invite booking links the referrer", invitee?.referredBy?.referrerId === referrer.id, invitee)
  check("invitee lead source = Referral", invitee?.leadSource === "Referral")

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { console.log(failures.map((f) => `  ✗ ${f}`).join("\n")); process.exitCode = 1 }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
