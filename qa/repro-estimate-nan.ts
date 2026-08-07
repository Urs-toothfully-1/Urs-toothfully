/**
 * Reproduces the production "Failed to save estimate" bug and proves the fix.
 *
 * Production had advance_percent stored as an empty string, so every reader did
 * parseFloat("") === NaN and the estimate insert died on Decimal(NaN). Run this
 * against a throwaway database:
 *
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/repro-estimate-nan.ts
 */
import { prisma } from "@/lib/prisma"
import { estimateService } from "@/server/services/estimate.service"
import { queueService } from "@/server/services/queue.service"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { settingNumber, assertNumericSetting } from "@/lib/settings-value"

const OUTRAM = "branch-outram-0000-0000-000000000001"

let failures = 0
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) failures++
}

async function main() {
  // ── the pure helper ──
  console.log("\nsettingNumber / assertNumericSetting")
  check('empty string falls back (was NaN)', settingNumber("", 20) === 20)
  check("null falls back", settingNumber(null, 20) === 20)
  check("whitespace falls back", settingNumber("   ", 20) === 20)
  check("garbage falls back", settingNumber("abc", 20) === 20)
  check("real value is used", settingNumber("15", 20) === 15)
  check("decimal value is used", settingNumber("12.5", 20) === 12.5)
  check("blank is refused on write", !!assertNumericSetting("advance_percent", ""))
  check("non-numeric is refused on write", !!assertNumericSetting("advance_percent", "abc"))
  check("out-of-range is refused on write", !!assertNumericSetting("advance_percent", "500"))
  check("a good value is accepted on write", assertNumericSetting("advance_percent", "20") === null)
  check("non-numeric keys are untouched", assertNumericSetting("prescription_mode", "") === null)

  // ── the real flow, with production's exact broken setting ──
  console.log("\nestimate save with advance_percent = \"\" (production's state)")
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
  await prisma.systemSetting.deleteMany({ where: { key: "advance_percent" } })
  await prisma.systemSetting.create({
    data: { key: "advance_percent", value: "", updatedById: admin.id },
  })
  check('stored setting really is ""', (await settingsRepository.get("advance_percent", OUTRAM)) === "")

  const doctor = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" } })
  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", branchId: OUTRAM } })
  const patient = await prisma.patient.findFirstOrThrow({ where: { isDeleted: false } })
  const master = (await treatmentRepository.findAll())[0] as { id: string; name: string; category: string }

  const { visit } = await queueService.addToQueue(
    { patientId: patient.id, branchId: OUTRAM, visitType: "CONSULTATION", doctorId: doctor.id },
    reception.id
  )

  let estimateId = ""
  try {
    const est = await estimateService.create(
      {
        patientId: patient.id, branchId: OUTRAM, visitId: visit.id,
        items: [{
          treatmentId: master.id, treatmentName: master.name, category: master.category,
          toothNumber: "32", quantity: 1, unitRate: 18000, plannedSittings: 3, sortOrder: 0,
        }],
      },
      doctor.id
    )
    estimateId = est.id
    check("estimate saves despite the broken setting", true)
    check("advance fell back to 20% of 18000", Number(est.advanceRequired) === 3600, Number(est.advanceRequired))
    check("total is a real number", Number(est.total) === 18000, Number(est.total))
  } catch (e) {
    check("estimate saves despite the broken setting", false, e instanceof Error ? e.message : e)
  }

  // updateSettingAction is not exercised here — importing it pulls in jose (ESM),
  // which ts-node cannot require. Its guard is assertNumericSetting, checked above,
  // and the browser test covers the form itself.

  // ── restore a sane value ──
  await prisma.systemSetting.updateMany({ where: { key: "advance_percent" }, data: { value: "20" } })
  check("restored to 20", (await settingsRepository.get("advance_percent", OUTRAM)) === "20")

  if (estimateId) {
    // Items are RESTRICT-linked, so they go first.
    await prisma.estimateItem.deleteMany({ where: { estimateId } }).catch(() => {})
    await prisma.estimate.delete({ where: { id: estimateId } }).catch(() => {})
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`)
  await prisma.$disconnect()
  process.exit(failures ? 1 : 0)
}

main().catch(async (e) => {
  console.error("FATAL:", e)
  await prisma.$disconnect()
  process.exit(2)
})
