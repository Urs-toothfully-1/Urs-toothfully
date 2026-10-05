/**
 * Regression checks for the 2026-09-16 audit: payment/estimate patient mismatch,
 * deleted payments still counted as revenue, concurrent appointment double-booking,
 * reschedule bypassing the per-day limit, bad durations, impossible calendar dates.
 * THROWAWAY database only (writes synthetic rows):
 *   DATABASE_URL=…/toothfully_deeptest TS_NODE_PROJECT=qa/tsconfig.qa.json \
 *   npx ts-node -r tsconfig-paths/register qa/check-audit-fixes.ts
 */
import assert from "node:assert"
import { prisma } from "@/lib/prisma"
import { paymentService } from "@/server/services/payment.service"
import { appointmentService } from "@/server/services/appointment.service"
import { getDailyRevenue } from "@/lib/reports/daily-revenue"
import { isValidDateStr } from "@/lib/ist"

async function main() {
  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", isActive: true } })
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR", isActive: true } })
  // Needs an unpaid balance, or the old code rejects for the wrong reason (overpayment).
  const estimates = await prisma.estimate.findMany({ where: { isDeleted: false }, orderBy: { createdAt: "desc" } })
  let estimate: (typeof estimates)[number] | undefined
  for (const e of estimates) {
    if ((await paymentService.getOutstandingByEstimate(e.id)) >= 1) { estimate = e; break }
  }
  assert.ok(estimate, "no estimate with an unpaid balance in this database")
  const a = await prisma.patient.findUniqueOrThrow({ where: { id: estimate.patientId } })
  const b = await prisma.patient.findFirstOrThrow({ where: { isDeleted: false, id: { not: a.id } } })
  const branchId = estimate.branchId

  const failures: string[] = []
  const check = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); console.log("✓", label) } catch (e) { failures.push(label); console.log("✗", label, "—", (e as Error).message.split("\n")[0]) }
  }

  // 1. A payment against someone else's estimate is refused.
  await check("payment for another patient's estimate rejected", async () => {
    const r = await paymentService.create({ paymentType: "TREATMENT", estimateId: estimate!.id, patientId: b.id, branchId, amount: 1, mode: "CASH" } as any, reception.id)
      .catch((e: Error) => e)
    if (!(r instanceof Error)) await paymentService.softDelete(r.payment.id, reception.id, "audit check cleanup")
    assert.match(String(r instanceof Error ? r.message : "accepted"), /does not belong/)
  })

  // 2. Deleting a payment takes it out of daily revenue.
  await check("deleted payment removed from revenue", async () => {
    const before = (await getDailyRevenue(new Date(), branchId)).grandTotal
    const { payment } = await paymentService.create({ paymentType: "CONSULTATION", patientId: a.id, branchId, amount: 777, mode: "CASH" } as any, reception.id)
    await paymentService.softDelete(payment.id, reception.id, "audit regression check")
    const after = (await getDailyRevenue(new Date(), branchId)).grandTotal
    // Keep the throwaway DB's totals clean even when this check fails.
    await prisma.accountingEntry.updateMany({ where: { paymentId: payment.id }, data: { isDeleted: true } })
    assert.equal(after, before)
  })

  // 4. Two simultaneous bookings for one doctor slot: exactly one wins.
  const slot = new Date(Date.now() + 400 * 86_400_000)
  slot.setUTCHours(5, 0, 0, 0)
  await check("concurrent double-booking prevented", async () => {
    const results = await Promise.allSettled([a, b].map((p) =>
      appointmentService.create({ patientId: p.id, doctorId: doctor.id, branchId, scheduledAt: slot }, reception.id)
    ))
    const won = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>[]
    await prisma.appointment.deleteMany({ where: { id: { in: won.map((r) => r.value.id) } } })
    assert.equal(won.length, 1, `expected 1 booking, got ${won.length}`)
  })

  // 6. Rescheduling can't push a patient past two appointments in a day.
  await check("reschedule respects the per-patient daily limit", async () => {
    const dayA = new Date(Date.now() + 401 * 86_400_000); dayA.setUTCHours(4, 0, 0, 0)
    const at = (d: Date, h: number) => { const x = new Date(d); x.setUTCHours(h, 0, 0, 0); return x }
    const dayB = new Date(dayA.getTime() + 86_400_000)
    const made: string[] = []
    try {
      for (const t of [at(dayA, 4), at(dayA, 6), at(dayB, 4)]) {
        made.push((await appointmentService.create({ patientId: a.id, doctorId: doctor.id, branchId, scheduledAt: t }, reception.id)).id)
      }
      const r = await appointmentService.reschedule(made[2], at(dayA, 8), reception.id).then(() => "accepted", (e: Error) => e.message)
      assert.match(r, /already has 2 appointments/)
    } finally {
      await prisma.appointment.deleteMany({ where: { id: { in: made } } })
    }
  })

  // 7. Durations must be sane whole minutes.
  await check("non-positive / fractional durations rejected", async () => {
    const slot7 = new Date(Date.now() + 403 * 86_400_000)
    for (const durationMins of [-30, 0, 12.5, 100000]) {
      const r = await appointmentService.create({ patientId: a.id, doctorId: doctor.id, branchId, scheduledAt: slot7, durationMins }, reception.id)
        .then(async (x) => { await prisma.appointment.delete({ where: { id: x.id } }); return "accepted" }, (e: Error) => e.message)
      assert.match(r, /Duration must be/, `duration ${durationMins}`)
    }
  })

  // 8. Only real calendar days pass the URL date guard.
  await check("impossible calendar dates rejected", async () => {
    for (const bad of ["2026-99-99", "2026-02-30", "2026-13-01", "abc", undefined]) assert.equal(isValidDateStr(bad), false, String(bad))
    for (const good of ["2026-09-16", "2028-02-29"]) assert.equal(isValidDateStr(good), true, good)
  })

  if (failures.length) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error("✗", e.message); await prisma.$disconnect(); process.exit(1) })
