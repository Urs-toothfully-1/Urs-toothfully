/**
 * Correctness checks for the staged, paginated patient list.
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '\n')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-patient-list.ts
 *
 * Pagination is where a list quietly loses or repeats rows, and the stage
 * counts on the filter cards come from a different query than the rows below
 * them — so both are checked against each other and against the raw table.
 * Read-only.
 */
import { prisma } from "@/lib/prisma"
import {
  patientListRepository,
  PATIENT_PAGE_SIZE,
  PATIENT_STAGES,
  type PatientStage,
} from "@/server/repositories/patient.repository"

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`)
  if (!ok) failures++
}

async function pageThrough(filters: Parameters<typeof patientListRepository.findPage>[0], stage: PatientStage | null) {
  const seen: string[] = []
  for (let page = 1; page <= 500; page++) {
    const rows = await patientListRepository.findPage(filters, stage, page)
    if (rows.length === 0) break
    seen.push(...rows.map((r) => r.id))
    if (rows.length < PATIENT_PAGE_SIZE) break
  }
  return seen
}

async function main() {
  const filters = {}

  // 1. Stage counts must account for every patient, exactly once.
  const counts = await patientListRepository.countByStage(filters)
  const totalStaged = PATIENT_STAGES.reduce((s, k) => s + counts[k], 0)
  const totalPatients = await prisma.patient.count({ where: { isDeleted: false } })
  check(totalStaged === totalPatients, `stage counts sum to every patient (${totalStaged} vs ${totalPatients})`)

  // 2. Paging the unfiltered list yields each patient once — no gaps, no repeats.
  const all = await pageThrough(filters, null)
  check(all.length === totalPatients, `paging returns every patient (${all.length} of ${totalPatients})`)
  check(new Set(all).size === all.length, "paging never repeats a patient across pages")

  // 3. Each stage's pages match that stage's advertised count.
  for (const stage of PATIENT_STAGES) {
    const ids = await pageThrough(filters, stage)
    check(ids.length === counts[stage], `stage "${stage}" lists ${counts[stage]} as counted (got ${ids.length})`)
  }

  // 4. A row's stage always matches the bucket it was listed under.
  for (const stage of PATIENT_STAGES) {
    const rows = await patientListRepository.findPage(filters, stage, 1)
    check(rows.every((r) => r.stage === stage), `rows under "${stage}" all carry that stage`)
  }

  // 5. The date filter narrows to exactly the patients registered in range.
  const newest = await prisma.patient.findFirst({
    where: { isDeleted: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
  })
  if (newest) {
    const from = new Date(newest.createdAt); from.setHours(0, 0, 0, 0)
    const to = new Date(newest.createdAt); to.setHours(23, 59, 59, 999)
    const expected = await prisma.patient.count({
      where: { isDeleted: false, createdAt: { gte: from, lte: to } },
    })
    const ranged = await patientListRepository.countByStage({ from, to })
    const got = PATIENT_STAGES.reduce((s, k) => s + ranged[k], 0)
    check(got === expected, `date range matches the table (${got} vs ${expected})`)
    check(got <= totalPatients, "a date range never returns more than the unfiltered list")
  }

  // 6. Sorting is newest-first, which the paging offsets depend on.
  const firstPage = await patientListRepository.findPage(filters, null, 1)
  const descending = firstPage.every(
    (r, i) => i === 0 || firstPage[i - 1].createdAt.getTime() >= r.createdAt.getTime()
  )
  check(descending, "rows come back newest-registered first")

  console.log(failures === 0 ? "\nall patient-list checks passed" : `\n${failures} FAILED`)
  process.exitCode = failures ? 1 : 0
}

main().finally(() => prisma.$disconnect())
