/**
 * Zero-dependency full-database backup for the Free tier (no Supabase automated
 * backups, no pg_dump installed). Dumps every table to a timestamped JSON using
 * the Prisma client that already ships with the app.
 *
 * Run against production:   npm run db:backup
 * Run against local:        ./node_modules/.bin/dotenvx run -f .env.local -- node scripts/backup-db.mjs
 *
 * Restore is manual (JSON, not SQL) — see scripts/restore-db.mjs. For a fully
 * restorable SQL dump instead, use `supabase db dump` (needs the Supabase CLI).
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { writeFileSync, mkdirSync } from "fs"

const OUT_DIR = process.env.BACKUP_DIR || "C:/Users/Asus/Desktop/Urs_toothfully/backups"

function replacer(_key, value) {
  if (typeof value === "bigint") return value.toString()
  return value
}

async function main() {
  const prisma = new PrismaClient()
  mkdirSync(OUT_DIR, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const dump = { exportedAt: new Date().toISOString(), tables: {} }
  let total = 0

  // Iterate every model in the schema so new tables are picked up automatically.
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1)
    const rows = await prisma[delegate].findMany()
    dump.tables[model.name] = rows
    total += rows.length
    console.log(`  ${model.name.padEnd(28)} ${rows.length}`)
  }

  const path = `${OUT_DIR}/full-db-${stamp}.json`
  writeFileSync(path, JSON.stringify(dump, replacer, 2))
  console.log(`\nBacked up ${total} rows across ${Prisma.dmmf.datamodel.models.length} tables`)
  console.log(`→ ${path}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("Backup failed:", e.message)
  process.exit(1)
})
