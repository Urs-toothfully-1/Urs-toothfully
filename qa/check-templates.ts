/**
 * Checks the database guarantees the Templates page relies on.
 *
 * Run against the SAME database the app uses — .env.local overrides .env for
 * the Next.js server but the Prisma CLI and plain scripts only read .env, which
 * is how migrations once landed in the wrong database entirely:
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '
')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only  *     -r tsconfig-paths/register qa/check-templates.ts
 *
 * Creates and removes its own rows; safe to re-run.
 */
import { prisma } from "@/lib/prisma"
async function main() {
  const b = await prisma.branch.findFirstOrThrow({ select: { id: true } })
  const NAME = "__qa temp phrase__"
  const PROTO = "__qa temp protocol__"
  let failures = 0
  const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++ }

  await prisma.diagnosis.deleteMany({ where: { name: NAME } })
  await prisma.medicineTemplate.deleteMany({ where: { name: PROTO } })

  // 1. Same wording allowed in different sections (per-section uniqueness)
  const d1 = await prisma.diagnosis.create({ data: { branchId: b.id, name: NAME, specialty: "Other", section: "COMPLAINT", isStandard: false } })
  const d2 = await prisma.diagnosis.create({ data: { branchId: b.id, name: NAME, specialty: "Endodontics", section: "DIAGNOSIS", isStandard: false } })
  check(!!d1 && !!d2, "same wording can exist as both a complaint and a diagnosis")

  // 2. Duplicate within one section is rejected by the constraint
  let dup = false
  try { await prisma.diagnosis.create({ data: { branchId: b.id, name: NAME, specialty: "Other", section: "COMPLAINT", isStandard: false } }) }
  catch { dup = true }
  check(dup, "duplicate wording in the same section is rejected")

  // 3. Archiving hides it from the picker query but keeps the row
  await prisma.diagnosis.update({ where: { id: d1.id }, data: { isActive: false } })
  const visible = await prisma.diagnosis.findMany({ where: { branchId: b.id, section: "COMPLAINT", isActive: true, name: NAME } })
  const stillThere = await prisma.diagnosis.findUnique({ where: { id: d1.id } })
  check(visible.length === 0 && !!stillThere, "archived entry leaves the picker but is not deleted")

  // 4. Editing a protocol replaces its items rather than accumulating them
  const p = await prisma.medicineTemplate.create({
    data: { branchId: b.id, name: PROTO, createdBy: "qa",
      items: { create: [{ medicine: "A", frequency: "1-0-1", duration: "3 days", sortOrder: 0 }, { medicine: "B", frequency: "1-1-1", duration: "5 days", sortOrder: 1 }] } },
  })
  await prisma.$transaction([
    prisma.medicineTemplateItem.deleteMany({ where: { templateId: p.id } }),
    prisma.medicineTemplate.update({ where: { id: p.id }, data: { items: { create: [{ medicine: "C", frequency: "0-0-1", duration: "7 days", sortOrder: 0 }] } } }),
  ])
  const after = await prisma.medicineTemplateItem.findMany({ where: { templateId: p.id } })
  check(after.length === 1 && after[0].medicine === "C", "editing a protocol replaces items, never accumulates")

  // 5. Deleting a protocol cascades to its items
  await prisma.medicineTemplate.delete({ where: { id: p.id } })
  const orphans = await prisma.medicineTemplateItem.findMany({ where: { templateId: p.id } })
  check(orphans.length === 0, "deleting a protocol removes its items")

  await prisma.diagnosis.deleteMany({ where: { name: NAME } })
  console.log(failures === 0 ? "\nall template checks passed" : `\n${failures} FAILED`)
  process.exitCode = failures ? 1 : 0
}
main().finally(() => prisma.$disconnect())
