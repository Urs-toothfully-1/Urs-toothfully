/**
 * Checks the patient balance shown in the profile header and on Overview.
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '\n')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-patient-balance.ts
 *
 * This number now appears on every tab of a patient's profile and is the first
 * thing reception reads before taking money. The failure that matters is a
 * quiet one: a cancelled plan or a deleted payment slipping back into the sum
 * and inventing a debt the patient does not owe.
 *
 * Creates and removes its own rows; safe to re-run.
 */
import { prisma } from "@/lib/prisma"
import { getPatientBalance } from "@/server/services/patient-summary.service"

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`)
  if (!ok) failures++
}

const TAG = "qa-balance-check"

async function main() {
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true } })
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" }, select: { id: true } })

  const patient = await prisma.patient.create({
    data: {
      patientId: `QA-${Date.now()}`,
      fullName: "QA Balance Check",
      dateOfBirth: new Date("1990-01-01"),
      gender: "OTHER",
      mobile: "9000000000",
      registrationBranch: { connect: { id: branch.id } },
      createdBy: { connect: { id: doctor.id } },
    },
    select: { id: true },
  })

  const visit = await prisma.patientVisit.create({
    data: {
      visitNo: `QAV-${Date.now()}`,
      patientId: patient.id, branchId: branch.id, doctorId: doctor.id,
      createdById: doctor.id,
      visitType: "CONSULTATION",
    },
    select: { id: true },
  })

  const mkEstimate = (no: string, total: number, extra: Record<string, unknown> = {}) =>
    prisma.estimate.create({
      data: {
        estimateNo: no,
        patient: { connect: { id: patient.id } },
        branch: { connect: { id: branch.id } },
        doctor: { connect: { id: doctor.id } },
        visit: { connect: { id: visit.id } },
        subtotal: total, total, notes: TAG, ...extra,
      },
      select: { id: true },
    })

  const mkPayment = (estimateId: string, amount: number, extra: Record<string, unknown> = {}) =>
    prisma.payment.create({
      data: {
        patient: { connect: { id: patient.id } },
        branch: { connect: { id: branch.id } },
        estimate: { connect: { id: estimateId } },
        collectedBy: { connect: { id: doctor.id } },
        amount, paymentType: "TREATMENT", mode: "CASH",
        notes: TAG, ...extra,
      },
    })

  try {
    // 1. A plain active estimate is owed in full.
    const active = await mkEstimate(`QA-A-${Date.now()}`, 10000)
    let b = await getPatientBalance(patient.id)
    check(b.estimated === 10000 && b.outstanding === 10000, "an active estimate is owed in full")

    // 2. A treatment payment reduces the balance, not the billed total.
    await mkPayment(active.id, 4000)
    b = await getPatientBalance(patient.id)
    check(b.paid === 4000 && b.outstanding === 6000 && b.estimated === 10000,
      "a payment reduces the balance and leaves the billed total alone")

    // 3. A cancelled plan is not a debt.
    await mkEstimate(`QA-C-${Date.now()}`, 50000, { status: "CANCELLED" })
    b = await getPatientBalance(patient.id)
    check(b.outstanding === 6000, "a cancelled estimate adds nothing to the balance")

    // 4. Nor is a soft-deleted one.
    await mkEstimate(`QA-D-${Date.now()}`, 70000, { isDeleted: true })
    b = await getPatientBalance(patient.id)
    check(b.outstanding === 6000, "a deleted estimate adds nothing to the balance")

    // 5. A reversed payment stops counting as paid.
    const reversed = await mkPayment(active.id, 1000)
    await prisma.payment.update({ where: { id: reversed.id }, data: { isDeleted: true } })
    b = await getPatientBalance(patient.id)
    check(b.paid === 4000 && b.outstanding === 6000, "a deleted payment stops counting as paid")

    // 6. A consultation fee is billed separately and must not clear treatment debt.
    await mkPayment(active.id, 500, { paymentType: "CONSULTATION" })
    b = await getPatientBalance(patient.id)
    check(b.outstanding === 6000, "a consultation fee does not pay down the treatment balance")

    // 7. Overpayment floors at zero rather than showing a negative debt.
    await mkPayment(active.id, 99999)
    b = await getPatientBalance(patient.id)
    check(b.outstanding === 0, "an overpayment floors the balance at zero")
  } finally {
    await prisma.payment.deleteMany({ where: { patientId: patient.id } })
    await prisma.estimate.deleteMany({ where: { patientId: patient.id } })
    await prisma.patientVisit.deleteMany({ where: { patientId: patient.id } })
    await prisma.patient.delete({ where: { id: patient.id } })
  }

  console.log(failures === 0 ? "\nall patient-balance checks passed" : `\n${failures} FAILED`)
  process.exitCode = failures ? 1 : 0
}

main().finally(() => prisma.$disconnect())
