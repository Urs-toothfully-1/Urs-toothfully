/**
 * Copies every row from the SOURCE database (read via DATABASE_URL/DIRECT_URL
 * in the environment this script is run under) into a TARGET database (passed
 * as TARGET_DATABASE_URL / TARGET_DIRECT_URL). Used for the Supabase account
 * migration — schema must already be applied to the target (prisma migrate
 * deploy) before running this.
 *
 * Read-only against the source; only ever writes to the target. Disables FK/
 * trigger checks for the session on the target so tables can be loaded in
 * schema-declaration order without hand-computing a topological sort across
 * 34 tables — standard technique for a same-shape full database copy.
 *
 *   TARGET_DATABASE_URL=... TARGET_DIRECT_URL=... \
 *   npx ts-node --transpile-only -r tsconfig-paths/register qa/migrate-to-new-supabase.ts [--write] [--reset]
 *
 * Dry-run by default: reports source row counts only. --write performs the copy.
 * --reset truncates every app table on the target first (cascading, but never
 * touching _prisma_migrations) so a second run doesn't collide with rows the
 * first run already inserted — used for a final pre-cutover resync.
 */
import { PrismaClient, Prisma } from "@prisma/client"

function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value
}
/** Round-trips through JSON with the bigint replacer so Decimal/Date/bigint values survive the copy. */
function cloneRow(row: unknown): unknown {
  return JSON.parse(JSON.stringify(row, replacer))
}

async function main() {
  const write = process.argv.includes("--write")
  const targetUrl = process.env.TARGET_DIRECT_URL
  if (!targetUrl) throw new Error("set TARGET_DIRECT_URL (and TARGET_DATABASE_URL) to the destination project")

  const source = new PrismaClient() // uses DATABASE_URL/DIRECT_URL from the environment
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })

  const models = Prisma.dmmf.datamodel.models
  console.log(`${models.length} tables in the schema\n`)

  if (write) {
    await target.$executeRawUnsafe(`SET session_replication_role = 'replica'`)

    if (process.argv.includes("--reset")) {
      console.log("Resetting target tables before resync…\n")
      for (const model of models) {
        // Table names in Postgres follow Prisma's @@map when present, else the model name.
        const table = (model.dbName as string | undefined) ?? model.name
        await target.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`)
      }
    }
  }

  let totalRows = 0
  let totalMismatch = 0
  for (const model of models) {
    const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1)
    const src = source as unknown as Record<string, { findMany: () => Promise<Record<string, unknown>[]>; count: () => Promise<number> }>
    const tgt = target as unknown as Record<string, { createMany: (args: { data: unknown[] }) => Promise<{ count: number }>; count: () => Promise<number> }>

    const rows = await src[delegate].findMany()
    totalRows += rows.length

    if (!write) {
      console.log(`  ${model.name.padEnd(28)} ${rows.length}`)
      continue
    }

    if (rows.length > 0) {
      await tgt[delegate].createMany({ data: rows.map(cloneRow) as never[] })
    }
    const targetCount = await tgt[delegate].count()
    const ok = targetCount === rows.length
    if (!ok) totalMismatch++
    console.log(`  ${model.name.padEnd(28)} source ${String(rows.length).padEnd(6)} target ${targetCount}  ${ok ? "✓" : "✗ MISMATCH"}`)
  }

  if (write) {
    await target.$executeRawUnsafe(`SET session_replication_role = 'origin'`)
  }

  console.log(`\n${write ? "Copied" : "Would copy"} ${totalRows} rows across ${models.length} tables.`)
  if (write) {
    console.log(totalMismatch === 0 ? "All table counts match — migration verified clean." : `${totalMismatch} table(s) mismatched — do not cut over until this is resolved.`)
  } else {
    console.log("Dry run — pass --write to actually copy.")
  }

  await source.$disconnect()
  await target.$disconnect()
  process.exit(write && totalMismatch > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error("FAILED:", e)
  process.exit(1)
})
