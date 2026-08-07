/**
 * Hard-deletes a patient and every record hanging off them. For clearing test
 * data out of a real database — ordinary patient removal is the soft delete in
 * the app, which keeps the history.
 *
 *   npx ts-node --transpile-only -r tsconfig-paths/register qa/purge-patient.ts <patientId> [--write]
 *
 * Dry-run by default. Take a backup first (npm run db:backup).
 */
import { prisma } from "@/lib/prisma"

async function main() {
  const humanId = process.argv[2]
  const write = process.argv.includes("--write")
  if (!humanId) throw new Error("usage: purge-patient.ts <PAT-YYYY-NNNNN> [--write]")

  const patient = await prisma.patient.findFirst({
    where: { patientId: humanId },
    select: { id: true, patientId: true, fullName: true },
  })
  if (!patient) throw new Error(`no patient with id ${humanId}`)
  const id = patient.id

  const visits = await prisma.patientVisit.findMany({ where: { patientId: id }, select: { id: true } })
  const estimates = await prisma.estimate.findMany({ where: { patientId: id }, select: { id: true } })
  const payments = await prisma.payment.findMany({ where: { patientId: id }, select: { id: true } })
  const visitIds = visits.map((v) => v.id)
  const estimateIds = estimates.map((e) => e.id)
  const paymentIds = payments.map((p) => p.id)
  const auditIds = [id, ...visitIds, ...estimateIds, ...paymentIds]

  console.log(`Purging ${patient.patientId} — ${patient.fullName}`)
  if (!write) console.log("(dry run — pass --write to delete)\n")

  // Children first: several relations are RESTRICT, so order matters.
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["accountingEntry", () => prisma.accountingEntry.deleteMany({ where: { OR: [{ patientId: id }, { paymentId: { in: paymentIds } }] } })],
    ["receipt", () => prisma.receipt.deleteMany({ where: { paymentId: { in: paymentIds } } })],
    ["payment", () => prisma.payment.deleteMany({ where: { patientId: id } })],
    ["paymentAgreement", () => prisma.paymentAgreement.deleteMany({ where: { estimateId: { in: estimateIds } } })],
    ["estimateItem", () => prisma.estimateItem.deleteMany({ where: { estimateId: { in: estimateIds } } })],
    ["estimate", () => prisma.estimate.deleteMany({ where: { patientId: id } })],
    ["prescriptionRecord", () => prisma.prescriptionRecord.deleteMany({ where: { patientId: id } })],
    ["clinicalNote", () => prisma.clinicalNote.deleteMany({ where: { patientId: id } })],
    ["generatedDocument", () => prisma.generatedDocument.deleteMany({ where: { patientId: id } })],
    ["patientDocument", () => prisma.patientDocument.deleteMany({ where: { patientId: id } })],
    ["whatsAppMessage", () => prisma.whatsAppMessage.deleteMany({ where: { patientId: id } })],
    ["whatsAppConsent", () => prisma.whatsAppConsent.deleteMany({ where: { patientId: id } })],
    // AppointmentRequest has no patientId — it points at the appointment, so
    // detach it first or the appointment delete is blocked.
    ["appointmentRequest (detach)", async () => {
      const appts = await prisma.appointment.findMany({ where: { patientId: id }, select: { id: true } })
      if (!appts.length) return { count: 0 }
      return prisma.appointmentRequest.updateMany({
        where: { appointmentId: { in: appts.map((a) => a.id) } },
        data: { appointmentId: null },
      })
    }],
    ["appointment", () => prisma.appointment.deleteMany({ where: { patientId: id } })],
    ["queueEntry", () => prisma.queueEntry.deleteMany({ where: { patientId: id } })],
    ["patientVisit", () => prisma.patientVisit.deleteMany({ where: { patientId: id } })],
    ["dentalHistory", () => prisma.dentalHistory.deleteMany({ where: { patientId: id } })],
    ["patientMergeLog", () => prisma.patientMergeLog.deleteMany({ where: { primaryPatientId: id } })],
    ["patient", () => prisma.patient.deleteMany({ where: { id } })],
    // Polymorphic, no foreign key — cleared last so nothing points at a ghost.
    ["auditLog", () => prisma.auditLog.deleteMany({ where: { entityId: { in: auditIds } } })],
  ]

  let total = 0
  for (const [label, run] of steps) {
    if (!write) {
      console.log(`  would delete from ${label}`)
      continue
    }
    const { count } = await run().catch((e) => {
      console.error(`  ✗ ${label}: ${e instanceof Error ? e.message.split("\n")[0] : e}`)
      throw e
    })
    total += count
    if (count) console.log(`  ${label.padEnd(20)} ${count}`)
  }

  if (write) {
    const left = await prisma.patient.count({ where: { id } })
    console.log(`\nDeleted ${total} rows. Patient remaining: ${left}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("FAILED:", e)
  await prisma.$disconnect()
  process.exit(1)
})
