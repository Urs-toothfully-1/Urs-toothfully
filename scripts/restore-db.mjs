/**
 * Restore a backup produced by scripts/backup-db.mjs.
 *
 * Upserts every row by primary key in dependency order (parents first), so it
 * is safe to run into an empty database (e.g. a fresh Supabase project) or to
 * re-insert rows that were deleted. Existing rows are overwritten with the
 * backup's values.
 *
 * DRY RUN by default — prints what it would restore and changes nothing.
 *   node scripts/restore-db.mjs path/to/full-db-XXXX.json            # dry run
 *   node scripts/restore-db.mjs path/to/full-db-XXXX.json --confirm  # actually restore
 *
 * Point it at the RIGHT database via dotenvx:
 *   ./node_modules/.bin/dotenvx run -f .env.local -- node scripts/restore-db.mjs <file> --confirm
 */
import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"

// Parents before children so foreign keys always resolve.
const ORDER = [
  "Branch", "User", "DoctorAvailability", "TreatmentMaster", "TreatmentPackage", "TreatmentPackageItem",
  "PrescriptionTemplate", "ExaminationTemplate", "SystemSetting", "WhatsAppSettings", "WhatsAppTemplate",
  "Patient", "DentalHistory", "PatientVisit", "QueueEntry", "ClinicalNote", "PrescriptionRecord",
  "Estimate", "EstimateItem", "PaymentAgreement", "Payment", "Receipt",
  // ExportBatch must precede AccountingEntry — an exported entry carries exportBatchId.
  "ExportBatch", "AccountingEntry",
  "GeneratedDocument", "PatientDocument", "WhatsAppMessage", "WhatsAppConsent", "WhatsAppWebhookLog",
  "IntakeAttempt", "Appointment", "AppointmentRequest", "AuditLog", "PatientMergeLog",
]

const file = process.argv[2]
const confirm = process.argv.includes("--confirm")
if (!file) {
  console.error("Usage: node scripts/restore-db.mjs <backup.json> [--confirm]")
  process.exit(1)
}

async function main() {
  const backup = JSON.parse(readFileSync(file, "utf8"))
  const tables = backup.tables || {}
  console.log(`Backup from ${backup.exportedAt}`)
  console.log(confirm ? "MODE: RESTORE (writing)\n" : "MODE: DRY RUN (no writes) — pass --confirm to apply\n")

  const prisma = new PrismaClient()
  // Restore known tables in dependency order, then any not in the list.
  const names = [...ORDER.filter((n) => tables[n]), ...Object.keys(tables).filter((n) => !ORDER.includes(n))]

  let written = 0
  for (const name of names) {
    const rows = tables[name] ?? []
    if (rows.length === 0) continue
    const delegate = name.charAt(0).toLowerCase() + name.slice(1)
    if (!prisma[delegate]) {
      console.log(`  ${name.padEnd(24)} ${rows.length} rows — SKIPPED (no such model in current schema)`)
      continue
    }
    if (!confirm) {
      console.log(`  ${name.padEnd(24)} ${rows.length} rows would be restored`)
      continue
    }
    let ok = 0
    for (const row of rows) {
      try {
        await prisma[delegate].upsert({ where: { id: row.id }, create: row, update: row })
        ok++
      } catch (e) {
        console.error(`  ! ${name} id=${row.id}: ${e.message.split("\n")[0]}`)
      }
    }
    written += ok
    console.log(`  ${name.padEnd(24)} ${ok}/${rows.length} restored`)
  }

  if (confirm) console.log(`\nRestored ${written} rows.`)
  else console.log(`\nDry run complete — nothing written.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("Restore failed:", e.message)
  process.exit(1)
})
