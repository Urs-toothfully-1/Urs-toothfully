/**
 * Loads the dev database with realistic volume so the patients list can be
 * measured under production-like conditions (~3,000 patients).
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '\n')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/seed-perf-patients.ts [--remove]
 *
 * Every row it creates is tagged PERF- so --remove can take them all back out
 * without touching real records.
 */
import { prisma } from "@/lib/prisma"

const TAG = "PERF-"
const COUNT = 3000

async function remove() {
  const patients = await prisma.patient.findMany({
    where: { patientId: { startsWith: TAG } },
    select: { id: true },
  })
  const ids = patients.map((p) => p.id)
  if (ids.length === 0) {
    console.log("nothing to remove")
    return
  }
  // Children first — these rows exist only to give the list something to stage on.
  await prisma.receipt.deleteMany({ where: { patientId: { in: ids } } })
  await prisma.accountingEntry.deleteMany({ where: { patientId: { in: ids } } })
  await prisma.payment.deleteMany({ where: { patientId: { in: ids } } })
  await prisma.estimateItem.deleteMany({ where: { estimate: { patientId: { in: ids } } } })
  await prisma.estimate.deleteMany({ where: { patientId: { in: ids } } })
  await prisma.patientVisit.deleteMany({ where: { patientId: { in: ids } } })
  await prisma.patient.deleteMany({ where: { id: { in: ids } } })
  console.log(`removed ${ids.length} perf patients and their rows`)
}

async function seed() {
  const branches = await prisma.branch.findMany({ select: { id: true } })
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" }, select: { id: true } })
  const creator = await prisma.user.findFirstOrThrow({ select: { id: true } })
  const existing = await prisma.patient.count({ where: { patientId: { startsWith: TAG } } })
  if (existing > 0) {
    console.log(`${existing} perf patients already present — run with --remove first`)
    return
  }

  const now = Date.now()
  const DAY = 86_400_000

  for (let start = 0; start < COUNT; start += 500) {
    const batch = Array.from({ length: Math.min(500, COUNT - start) }, (_, k) => {
      const i = start + k
      return {
        patientId: `${TAG}${String(i).padStart(5, "0")}`,
        fullName: `Perf Patient ${i}`,
        dateOfBirth: new Date(1960 + (i % 50), i % 12, (i % 27) + 1),
        gender: (["MALE", "FEMALE", "OTHER"] as const)[i % 3],
        mobile: String(9000000000 + i),
        registrationBranchId: branches[i % branches.length].id,
        createdById: creator.id,
        // Spread across two years so the date filter has something to bite on.
        createdAt: new Date(now - (i % 730) * DAY),
      }
    })
    await prisma.patient.createMany({ data: batch })
    process.stdout.write(`\r  patients ${Math.min(start + 500, COUNT)}/${COUNT}`)
  }
  console.log("")

  // Give roughly two thirds a consultation payment and a third an estimate, so
  // all four stages are populated rather than everything landing in one bucket.
  const created = await prisma.patient.findMany({
    where: { patientId: { startsWith: TAG } },
    select: { id: true, registrationBranchId: true },
    orderBy: { patientId: "asc" },
  })

  const payments = created
    .filter((_, i) => i % 3 !== 0)
    .map((p) => ({
      paymentType: "CONSULTATION" as const,
      patientId: p.id,
      branchId: p.registrationBranchId,
      amount: 1000,
      mode: "CASH" as const,
      collectedById: doctor.id,
    }))
  for (let i = 0; i < payments.length; i += 500) {
    await prisma.payment.createMany({ data: payments.slice(i, i + 500) })
  }

  // An estimate needs a visit to hang off, so each estimated patient gets one.
  const estimated = created.filter((_, i) => i % 3 === 1)
  const visits = estimated.map((p, n) => ({
    id: `perf-visit-${n}`,
    visitNo: `${TAG}V-${n}`,
    patientId: p.id,
    branchId: p.registrationBranchId,
    visitType: "CONSULTATION" as const,
    createdById: creator.id,
  }))
  for (let i = 0; i < visits.length; i += 500) {
    await prisma.patientVisit.createMany({ data: visits.slice(i, i + 500) })
  }

  const estimates = estimated.map((p, n) => ({
    estimateNo: `${TAG}EST-${n}`,
    patientId: p.id,
    branchId: p.registrationBranchId,
    doctorId: doctor.id,
    visitId: visits[n].id,
    status: (n % 2 === 0 ? "ACTIVE" : "COMPLETED") as "ACTIVE" | "COMPLETED",
    subtotal: 5000,
    total: 5000,
  }))
  for (let i = 0; i < estimates.length; i += 500) {
    await prisma.estimate.createMany({ data: estimates.slice(i, i + 500) })
  }

  console.log(`seeded ${created.length} patients, ${payments.length} payments, ${estimates.length} estimates`)
}

const run = process.argv.includes("--remove") ? remove : seed
run()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
