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
  const rb = await referralService.referredBy(friend.id)
  check("'referred by' shows referrer + date", rb?.referrer.id === referrer.id && !!rb.createdAt)
  check("lead source set to Referral", (await prisma.patient.findUnique({ where: { id: friend.id } }))?.leadSource === "Referral")
  await expectThrows("second referrer for the same patient is refused", () =>
    referralService.linkReferrer({ refereeId: friend.id, referrerId: referrer.id, userId: reception.id }))
  await expectThrows("self-referral is refused", () =>
    referralService.linkReferrer({ refereeId: referrer.id, referrerId: referrer.id, userId: reception.id }))
  const ov = await referralService.overviewForPatient(referrer.id)
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

  console.log("\n── Rewards decided by the doctor")
  const referral = await prisma.referral.findUniqueOrThrow({ where: { refereeId: friend.id } })
  check("referral qualified after first treatment payment", referral.status === "QUALIFIED", referral.status)
  await expectThrows("discount reward needs an amount", () =>
    referralService.grantReward({ referralId: referral.id, type: "DISCOUNT_CREDIT", amount: 0, grantedById: doctor.id }))
  await referralService.grantReward({ referralId: referral.id, type: "DISCOUNT_CREDIT", amount: 500, grantedById: doctor.id })
  let rewards = await referralService.availableRewards(referrer.id)
  check("₹500 discount reward available to referrer", rewards.length === 1 && rewards[0].amount === 500, rewards)
  await expectThrows("reward can't be granted twice", () =>
    referralService.grantReward({ referralId: referral.id, type: "FREE_CHECKUP", amount: 0, grantedById: doctor.id }))

  // Second friend — reward granted while still PENDING (doctor's call), free check-up.
  const friend2 = await newPatient("QA Friend Two", `97${stamp}03`, reception.id)
  await referralService.linkReferrer({ refereeId: friend2.id, referrerId: referrer.id, userId: reception.id })
  const ref2 = await prisma.referral.findUniqueOrThrow({ where: { refereeId: friend2.id } })
  check("unpaid referral stays PENDING", ref2.status === "PENDING")
  await referralService.grantReward({ referralId: ref2.id, type: "FREE_CHECKUP", amount: 0, grantedById: doctor.id })
  rewards = await referralService.availableRewards(referrer.id)
  check("free check-up reward listed", rewards.some((r) => r.type === "FREE_CHECKUP"))
  await referralService.markRewardUsed(ref2.id, "Check-up done", doctor.id)
  check("used check-up no longer listed", !(await referralService.availableRewards(referrer.id)).some((r) => r.id === ref2.id))
  await expectThrows("can't mark used twice", () => referralService.markRewardUsed(ref2.id, "again", doctor.id))

  // Referrer uses the ₹500 discount on their own treatment invoice.
  const rVisit = await visitFor(referrer.id, reception.id, doctor.id)
  const rEst = await estimateService.create(
    { patientId: referrer.id, branchId: OUTRAM, visitId: rVisit.id, items: [{ treatmentName: "Filling", category: "RESTORATIVE", quantity: 1, unitRate: 1500, unitRateMax: 2500, sortOrder: 0 }] } as any,
    doctor.id
  )
  await expectThrows("someone else's reward can't be used", () =>
    invoiceService.create({ estimateId: est.id, items: [{ treatmentName: "X", quantity: 1, unitRate: 100 }], redeemReferralId: referral.id }, doctor.id))
  const rInv = await invoiceService.create({
    estimateId: rEst.id, items: [{ treatmentName: "Filling", quantity: 1, unitRate: 2000 }],
    discountValue: 500, discountIsPercent: false, redeemReferralId: referral.id,
  }, doctor.id)
  check("invoice with ₹500 reward discount = ₹1,500", Number(rInv.total) === 1500, Number(rInv.total))
  check("reward marked used on the invoice", (await prisma.referral.findUnique({ where: { id: referral.id } }))?.redeemedInvoiceId === rInv.id)
  check("used reward gone from available list", (await referralService.availableRewards(referrer.id)).length === 0)
  await invoiceService.softDelete(rInv.id, admin.id, "QA: undo")
  check("deleting the invoice returns the reward", (await referralService.availableRewards(referrer.id)).length === 1)

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { console.log(failures.map((f) => `  ✗ ${f}`).join("\n")); process.exitCode = 1 }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
