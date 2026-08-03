/**
 * Deep workflow simulation — six months in the life of one patient, driven
 * through the real service layer (the same code the server actions call).
 *
 * Run against a THROWAWAY database only:
 *   DATABASE_URL=postgresql://…/toothfully_deeptest \
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' -r tsconfig-paths/register qa/deep-journey.ts
 *
 * Every step asserts the invariant a receptionist/doctor would rely on. A
 * failed assertion is printed and collected; the run continues so one broken
 * step doesn't hide the rest.
 */
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { queueService } from "@/server/services/queue.service"
import { estimateService } from "@/server/services/estimate.service"
import { prescriptionService } from "@/server/services/prescription.service"
import { paymentService } from "@/server/services/payment.service"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { appointmentService } from "@/server/services/appointment.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import type { PrescriptionData } from "@/lib/prescription-types"

const OUTRAM = "branch-outram-0000-0000-000000000001"
const ALIPORE = "branch-alipo-0000-0000-000000000002"

let passed = 0
const failures: string[] = []
let phase = ""

function setPhase(p: string) {
  phase = p
  console.log(`\n──── ${p} ${"─".repeat(Math.max(0, 60 - p.length))}`)
}
function check(label: string, condition: boolean | undefined, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failures.push(`[${phase}] ${label}${detail !== undefined ? ` — got: ${JSON.stringify(detail)}` : ""}`)
    console.log(`  ✗ ${label}${detail !== undefined ? ` — got: ${JSON.stringify(detail)}` : ""}`)
  }
}
async function expectThrows(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    check(label, false, "no error thrown")
  } catch {
    check(label, true)
  }
}

/** Simulates elapsed time by pushing a visit and everything hanging off it into the past. */
async function backdateVisit(visitId: string, days: number) {
  const shift = (d: Date) => new Date(d.getTime() - days * 86_400_000)
  const visit = await prisma.patientVisit.findUniqueOrThrow({ where: { id: visitId } })
  await prisma.patientVisit.update({ where: { id: visitId }, data: { createdAt: shift(visit.createdAt), visitDate: shift(visit.visitDate) } })
  for (const q of await prisma.queueEntry.findMany({ where: { visitId } })) {
    await prisma.queueEntry.update({ where: { id: q.id }, data: { createdAt: shift(q.createdAt), sentAt: shift(q.sentAt) } })
  }
  for (const e of await prisma.estimate.findMany({ where: { visitId } })) {
    await prisma.estimate.update({ where: { id: e.id }, data: { createdAt: shift(e.createdAt) } })
  }
  for (const p of await prisma.payment.findMany({ where: { visitId } })) {
    await prisma.payment.update({ where: { id: p.id }, data: { createdAt: shift(p.createdAt), paymentDate: shift(p.paymentDate) } })
  }
  for (const r of await prisma.prescriptionRecord.findMany({ where: { visitId } })) {
    await prisma.prescriptionRecord.update({ where: { id: r.id }, data: { createdAt: shift(r.createdAt) } })
  }
}

async function main() {
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR", email: "dr.jashwant@toothfully.in" } })
  const doctor2 = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR", email: "dr.chetna@toothfully.in" } })
  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", branchId: OUTRAM } })
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
  const masters = await treatmentRepository.findAll()
  const rct = masters.find((t: any) => /root canal/i.test(t.name) && !/re-/i.test(t.name))!
  const crown = masters.find((t: any) => /crown/i.test(t.name))!

  // ══ MONTH 0 — first visit ══════════════════════════════════════
  setPhase("Month 0 · Registration")
  const stamp = Date.now().toString().slice(-6)
  const patient = await patientService.createWithHistory(
    {
      registrationBranchId: OUTRAM,
      fullName: "Deep Test Patient",
      dateOfBirth: "1988-04-12",
      gender: "MALE",
      mobile: `98${stamp}12`,
      email: `deep${stamp}@example.com`,
      address: "12 Test Road, Kolkata",
      leadSource: "Walk-in",
      referenceName: "",
      reasonForVisit: "Pain in lower right molar",
    },
    { allergies: true, allergiesDetail: "Penicillin", diabetes: true, consentGiven: true } as any,
    reception.id
  )
  check("patient created with a PAT- id", /^PAT-\d{4}-\d{5}$/.test(patient.patientId), patient.patientId)
  check("dental history v1 stored", (await prisma.dentalHistory.count({ where: { patientId: patient.id, isLatest: true } })) === 1)

  const dup = await patientService.findDuplicates({ mobile: patient.mobile, fullName: "Someone Else", dateOfBirth: "1990-01-01" })
  check("same mobile is detected as a duplicate", dup.mobileMatch?.id === patient.id)

  // ── Consultation fee gate ──
  setPhase("Month 0 · Consultation fee")
  const fee = await paymentService.getConsultationFee(OUTRAM)
  check("branch consultation fee configured", fee > 0, fee)
  const feePayment = await paymentService.create(
    { paymentType: "CONSULTATION", patientId: patient.id, branchId: OUTRAM, amount: fee, mode: "CASH" } as any,
    reception.id
  )
  check("consultation receipt number issued", /^RCP-\d{4}-\d{5}$/.test(feePayment.receipt.receiptNo), feePayment.receipt.receiptNo)

  // ── Queue ──
  setPhase("Month 0 · Queue")
  const { visit: visit1, queueEntry: q1 } = await queueService.addToQueue(
    { patientId: patient.id, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "Pain lower right", doctorId: doctor.id },
    reception.id
  )
  check("visit number issued", /^VISIT-\d{4}-\d{5}$/.test(visit1.visitNo), visit1.visitNo)
  check("token number starts at 1+", q1.tokenNumber >= 1, q1.tokenNumber)
  const active = await queueRepository.findActiveForPatient(patient.id, OUTRAM)
  check("profile sees the patient as queued", active?.id === q1.id)
  await queueService.updateStatus(q1.id, "WITH_DOCTOR", doctor.id)

  // ── Prescription (incl. the two things that were broken) ──
  setPhase("Month 0 · Prescription")
  const rx1 = await prescriptionService.ensureForVisit(visit1.id, doctor.id)
  await prescriptionService.update(
    rx1.id,
    {
      chiefComplaint: "Pain in lower right molar for 5 days, worse at night",
      onExamination: [{ toothNumbers: "46,47", finding: "Deep caries with pulp involvement" }],
      diagnosis: "Irreversible pulpitis w.r.t. 46; chronic gingivitis",
      treatments: [
        { treatmentId: rct.id, treatmentName: rct.name, category: rct.category, toothNumber: "46", quantity: 1 },
        // Custom treatment — no master row. This is what used to break the estimate.
        { treatmentName: "Dental Implant (custom)", category: "OTHER", toothNumber: "16,48", quantity: 2 },
      ],
      medicines: [{ name: "Amoxicillin 500mg", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food" }],
      advice: "Avoid chewing on the right side.",
      followUpDate: "",
      clinicalNotes: [],
    } as any,
    doctor.id
  )
  const rx1Data = (await prescriptionService.getById(rx1.id))!.prescriptionData as unknown as PrescriptionData
  check("diagnosis is persisted", rx1Data.diagnosis?.startsWith("Irreversible pulpitis"), rx1Data.diagnosis)
  check("multi-tooth selection kept verbatim", rx1Data.onExamination?.[0].toothNumbers === "46,47", rx1Data.onExamination?.[0].toothNumbers)
  check("custom treatment stored without a master id", rx1Data.treatments.some((t) => !t.treatmentId && /Implant/.test(t.treatmentName)))
  check("medical alerts pulled from dental history", (rx1Data.medicalAlerts ?? []).some((a) => /Penicillin/i.test(a)), rx1Data.medicalAlerts)

  // ── Estimate with a custom treatment ──
  setPhase("Month 0 · Estimate")
  const est1 = await estimateService.create(
    {
      patientId: patient.id,
      branchId: OUTRAM,
      visitId: visit1.id,
      discountPercent: 10,
      notes: "Phase 1 of treatment",
      items: [
        { treatmentId: rct.id, treatmentName: rct.name, category: rct.category, toothNumber: "46", quantity: 1, unitRate: 9000, plannedSittings: 3, sortOrder: 0 },
        { treatmentId: undefined, treatmentName: "Dental Implant (custom)", category: "OTHER", toothNumber: "16,48", quantity: 2, unitRate: 35000, plannedSittings: 2, sortOrder: 1 },
      ],
    },
    doctor.id
  )
  check("estimate number issued", /^EST-\d{4}-\d{5}$/.test(est1.estimateNo), est1.estimateNo)
  check("subtotal = 9000 + 70000", Number(est1.subtotal) === 79000, Number(est1.subtotal))
  check("10% discount applied", Number(est1.total) === 71100, Number(est1.total))
  check("advance = 20% of total", Math.round(Number(est1.advanceRequired)) === 14220, Number(est1.advanceRequired))
  const customItem = est1.items.find((i: any) => /Implant/.test(i.treatmentName))
  check("custom item saved with a null treatmentId", customItem?.treatmentId === null, customItem?.treatmentId)
  check("multi-tooth string survived to the estimate item", customItem?.toothNumber === "16,48", customItem?.toothNumber)

  // Editing the estimate must not wipe treatment progress, and must tolerate the
  // "custom" sentinel the UI sends for a custom row.
  setPhase("Month 0 · Estimate edit")
  const { Decimal } = await import("@prisma/client/runtime/library")
  await estimateRepository.update(est1.id, {
    subtotal: new Decimal(79000), total: new Decimal(79000), advanceRequired: new Decimal(15800),
    discountPercent: null, discountAmount: null, notes: "Discount withdrawn",
    items: est1.items.map((i: any, idx: number) => ({
      id: i.id,
      treatmentId: i.treatmentId ?? undefined,
      treatmentName: i.treatmentName, category: i.category, toothNumber: i.toothNumber ?? undefined,
      quantity: i.quantity, unitRate: new Decimal(Number(i.unitRate)), amount: new Decimal(Number(i.amount)),
      plannedSittings: i.plannedSittings, sortOrder: idx,
    })),
  })
  const est1b = (await estimateRepository.findById(est1.id))!
  check("estimate edit keeps the same item ids", est1b.items.every((i: any) => est1.items.some((o: any) => o.id === i.id)))
  check("estimate edit recomputed the total", Number(est1b.total) === 79000, Number(est1b.total))

  // ── Payment agreement + advance ──
  setPhase("Month 0 · Agreement & advance")
  const agreement = await paymentAgreementService.getOrSuggest(est1.id)
  check("a payment schedule is suggested", (agreement.stages as any[]).length > 0, (agreement.stages as any[])?.length)
  const advance = await paymentService.create(
    { paymentType: "ADVANCE", estimateId: est1.id, visitId: visit1.id, patientId: patient.id, branchId: OUTRAM, amount: 15800, mode: "UPI" } as any,
    reception.id
  )
  check("advance payment recorded", Number(advance.payment.amount) === 15800, Number(advance.payment.amount))
  const outstanding = await paymentService.getOutstandingByEstimate(est1.id, 79000)
  check("outstanding = total − advance", Number(outstanding) === 63200, Number(outstanding))
  const acc = await prisma.accountingEntry.count({ where: { branchId: OUTRAM } })
  check("accounting entries written for payments", acc >= 2, acc)

  await queueService.updateStatus(q1.id, "COMPLETED", doctor.id)
  const v1 = await prisma.patientVisit.findUniqueOrThrow({ where: { id: visit1.id } })
  check("visit status follows the queue to COMPLETED", v1.status === "COMPLETED", v1.status)

  // ══ MONTHS 1-3 — treatment sittings ════════════════════════════
  setPhase("Months 1-3 · Treatment sittings")
  await backdateVisit(visit1.id, 150)
  const rctItem = est1b.items.find((i: any) => i.treatmentId === rct.id)!
  for (let sitting = 1; sitting <= 3; sitting++) {
    const { queueEntry: qs } = await queueService.addToQueue(
      { patientId: patient.id, branchId: OUTRAM, visitType: "TREATMENT_SESSION", chiefComplaint: "RCT sitting", doctorId: doctor.id },
      reception.id
    )
    await queueService.updateStatus(qs.id, "WITH_DOCTOR", doctor.id)
    await estimateService.updateItemSittings(
      rctItem.id,
      { completedSittings: sitting, status: sitting >= rctItem.plannedSittings ? "COMPLETED" : "IN_PROGRESS" },
      doctor.id
    )
    await queueService.updateStatus(qs.id, "COMPLETED", doctor.id)
    const q = await prisma.queueEntry.findUniqueOrThrow({ where: { id: qs.id } })
    await backdateVisit(q.visitId, 150 - sitting * 30)
  }
  const rctAfter = await prisma.estimateItem.findUniqueOrThrow({ where: { id: rctItem.id } })
  check("RCT reached 3 of 3 sittings", rctAfter.completedSittings === 3, rctAfter.completedSittings)
  check("RCT auto-marked COMPLETED on the last sitting", rctAfter.status === "COMPLETED", rctAfter.status)
  const implantItem = est1b.items.find((i: any) => /Implant/.test(i.treatmentName))!
  check("the other treatment is still PENDING", (await prisma.estimateItem.findUniqueOrThrow({ where: { id: implantItem.id } })).status === "PENDING")

  setPhase("Months 1-3 · Instalments")
  for (const amount of [20000, 20000]) {
    await paymentService.create(
      { paymentType: "TREATMENT", estimateId: est1.id, patientId: patient.id, branchId: OUTRAM, amount, mode: "CARD" } as any,
      reception.id
    )
  }
  const outstanding2 = await paymentService.getOutstandingByEstimate(est1.id, 79000)
  check("outstanding after instalments = 23200", Number(outstanding2) === 23200, Number(outstanding2))
  await expectThrows("overpayment beyond the estimate total is rejected", () =>
    paymentService.create(
      { paymentType: "TREATMENT", estimateId: est1.id, patientId: patient.id, branchId: OUTRAM, amount: 999999, mode: "CASH" } as any,
      reception.id
    )
  )

  // ══ MONTH 6 — the patient comes back ═══════════════════════════
  setPhase("Month 6 · Return visit")
  const feePayment2 = await paymentService.create(
    { paymentType: "CONSULTATION", patientId: patient.id, branchId: OUTRAM, amount: fee, mode: "CASH" } as any,
    reception.id
  )
  check("second consultation fee accepted", !!feePayment2.receipt.receiptNo)
  const { visit: visit2, queueEntry: q2 } = await queueService.addToQueue(
    { patientId: patient.id, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "New pain upper left", doctorId: doctor2.id },
    reception.id
  )
  check("second visit gets its own visit number", visit2.visitNo !== visit1.visitNo, visit2.visitNo)
  check("token numbering restarts per day", q2.tokenNumber >= 1, q2.tokenNumber)

  const prevRecords = await prisma.prescriptionRecord.findMany({
    where: { patientId: patient.id, visitId: { not: visit2.id } },
    orderBy: { createdAt: "desc" }, take: 5, select: { prescriptionData: true },
  })
  const prev = prevRecords.map((r) => r.prescriptionData as unknown as PrescriptionData | null)
    .find((d) => d && ((d.treatments?.length ?? 0) > 0 || (d.medicines?.length ?? 0) > 0 || d.chiefComplaint))
  check("'load from last prescription' finds the earlier visit", !!prev && /Irreversible pulpitis/.test(prev.diagnosis ?? ""), prev?.diagnosis)

  await queueService.updateStatus(q2.id, "WITH_DOCTOR", doctor2.id)
  const rx2 = await prescriptionService.ensureForVisit(visit2.id, doctor2.id)
  check("the return visit gets its own prescription", rx2.id !== rx1.id)
  await prescriptionService.update(
    rx2.id,
    {
      chiefComplaint: "Sensitivity upper left",
      onExamination: [{ toothNumbers: "24", finding: "Cervical abrasion" }],
      diagnosis: "Dentine hypersensitivity w.r.t. 24",
      treatments: [{ treatmentId: crown.id, treatmentName: crown.name, category: crown.category, toothNumber: "24", quantity: 1 }],
      medicines: [],
      advice: "Desensitising paste twice daily",
      followUpDate: "",
      clinicalNotes: [{ date: new Date().toISOString().slice(0, 10), note: "Fluoride varnish applied" }],
    } as any,
    doctor2.id
  )
  const est2 = await estimateService.create(
    {
      patientId: patient.id, branchId: OUTRAM, visitId: visit2.id,
      items: [{ treatmentId: crown.id, treatmentName: crown.name, category: crown.category, toothNumber: "24", quantity: 1, unitRate: Number(crown.defaultAmount), plannedSittings: 2, sortOrder: 0 }],
    },
    doctor2.id
  )
  check("second estimate is independent of the first", est2.id !== est1.id && est2.estimateNo !== est1.estimateNo)
  const allEstimates = await estimateService.getByPatient(patient.id)
  check("patient now has 2 estimates on file", allEstimates.length === 2, allEstimates.length)
  const activeEstimates = await estimateService.getActiveByPatient(patient.id)
  check("both estimates are still ACTIVE (old one has unfinished work)", activeEstimates.length === 2, activeEstimates.length)
  await queueService.updateStatus(q2.id, "COMPLETED", doctor2.id)

  // ══ Cross-cutting behaviour ════════════════════════════════════
  setPhase("Carry-over of an unfinished visit")
  const { queueEntry: qStale } = await queueService.addToQueue(
    { patientId: patient.id, branchId: OUTRAM, visitType: "FOLLOW_UP", chiefComplaint: "Left open overnight", doctorId: doctor.id },
    reception.id
  )
  await prisma.queueEntry.update({ where: { id: qStale.id }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } })
  const todayQueue = await queueService.getTodayQueue(OUTRAM)
  check("yesterday's unfinished visit still shows in today's queue", todayQueue.some((e: any) => e.id === qStale.id))
  await prisma.queueEntry.update({ where: { id: qStale.id }, data: { createdAt: new Date(Date.now() - 40 * 86_400_000) } })
  const todayQueue2 = await queueService.getTodayQueue(OUTRAM)
  check("a 40-day-old open visit is NOT dragged into today's queue", !todayQueue2.some((e: any) => e.id === qStale.id))
  await prisma.queueEntry.update({ where: { id: qStale.id }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } })
  await queueService.updateStatus(qStale.id, "COMPLETED", reception.id)
  check("reception can close it days later", (await prisma.queueEntry.findUniqueOrThrow({ where: { id: qStale.id } })).status === "COMPLETED")
  const todayQueue3 = await queueService.getTodayQueue(OUTRAM)
  check("once closed it stops carrying over", !todayQueue3.some((e: any) => e.id === qStale.id))

  setPhase("Appointments")
  const tomorrow = new Date(Date.now() + 86_400_000)
  const appt = await appointmentService.create(
    { patientId: patient.id, doctorId: doctor.id, branchId: OUTRAM, scheduledAt: tomorrow, durationMins: 30, reason: "Implant review" },
    reception.id
  )
  check("appointment booked", appt.status === "SCHEDULED")
  await expectThrows("double-booking the same doctor/slot is blocked", () =>
    appointmentService.create({ patientId: patient.id, doctorId: doctor.id, branchId: OUTRAM, scheduledAt: tomorrow, durationMins: 30 }, reception.id)
  )
  await expectThrows("booking in the past is blocked", () =>
    appointmentService.create({ patientId: patient.id, doctorId: doctor.id, branchId: OUTRAM, scheduledAt: new Date(Date.now() - 86_400_000) }, reception.id)
  )
  await prisma.appointment.update({ where: { id: appt.id }, data: { scheduledAt: new Date(Date.now() - 3 * 86_400_000) } })
  const overdue = await appointmentService.listOverdue({ branchId: OUTRAM })
  check("a missed appointment surfaces as overdue", overdue.some((a) => a.id === appt.id))
  await appointmentService.updateStatus(appt.id, "COMPLETED", reception.id)
  check("an overdue appointment can still be closed", (await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status === "COMPLETED")
  check("closing it clears the overdue list", !(await appointmentService.listOverdue({ branchId: OUTRAM })).some((a) => a.id === appt.id))

  setPhase("Profile correction & deletion")
  await patientService.update(patient.id, { registrationBranchId: ALIPORE, mobile: patient.mobile }, admin.id)
  const moved = await prisma.patient.findUniqueOrThrow({ where: { id: patient.id } })
  check("registered branch can be corrected", moved.registrationBranchId === ALIPORE)
  check("branch correction is written to the audit log",
    (await prisma.auditLog.count({ where: { entityType: "Patient", entityId: patient.id, action: "UPDATE" } })) >= 1)
  await patientService.update(patient.id, { registrationBranchId: OUTRAM }, admin.id)

  const throwaway = await patientService.create(
    { registrationBranchId: OUTRAM, fullName: "Duplicate To Delete", dateOfBirth: "1995-01-01", gender: "FEMALE", mobile: `97${stamp}34`, email: "", address: "", leadSource: "", referenceName: "", reasonForVisit: "" },
    reception.id
  )
  await patientService.softDelete(throwaway.id, admin.id, "duplicate profile")
  const deleted = await prisma.patient.findUniqueOrThrow({ where: { id: throwaway.id } })
  check("delete is soft — the row survives", deleted.isDeleted && !!deleted.deletedAt)
  check("deletion reason is kept", deleted.deletionReason === "duplicate profile")
  check("deleted patient disappears from search", (await patientService.search("Duplicate To Delete")).length === 0)
  check("deleted patient is excluded from duplicate checks",
    (await patientService.findDuplicates({ mobile: deleted.mobile, fullName: "x", dateOfBirth: "1995-01-01" })).mobileMatch === null)

  setPhase("Reporting & money integrity")
  const payments = await paymentService.getByPatient(patient.id)
  const collected = payments.filter((p: any) => !p.isDeleted).reduce((s: number, p: any) => s + Number(p.amount), 0)
  check("all payments retrievable for the patient", payments.length === 5, payments.length)
  check("collected = 2 consultations + advance + 2 instalments", collected === fee * 2 + 15800 + 40000, collected)
  const entries = await prisma.accountingEntry.findMany({ where: { patientId: patient.id } })
  const accounted = entries.reduce((s, e) => s + Number(e.amount), 0)
  check("every payment produced an accounting entry", entries.length === payments.length, { entries: entries.length, payments: payments.length })
  check("accounting total matches money collected", accounted === collected, { accounted, collected })
  const receipts = new Set(payments.map((p: any) => p.receipt?.receiptNo))
  check("receipt numbers are unique", receipts.size === payments.length)
  const visits = await prisma.patientVisit.count({ where: { patientId: patient.id } })
  check("visit history covers every attendance", visits === 6, visits)
  const stillOpen = await prisma.patientVisit.count({ where: { patientId: patient.id, status: "IN_PROGRESS" } })
  check("no visit is left dangling IN_PROGRESS", stillOpen === 0, stillOpen)

  console.log(`\n${"═".repeat(64)}\n${passed} checks passed, ${failures.length} failed`)
  if (failures.length) {
    console.log("\nFAILURES:")
    failures.forEach((f, i) => console.log(`${i + 1}. ${f}`))
  }
  await prisma.$disconnect()
  process.exit(failures.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error("\nFATAL:", e)
  await prisma.$disconnect()
  process.exit(2)
})
