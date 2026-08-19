import { NextRequest, NextResponse } from "next/server"
import { gzipSync } from "node:zlib"
import { PrismaClient, Prisma } from "@prisma/client"
import { sendEmailWithAttachment } from "@/server/services/email.service"

export const maxDuration = 60

/**
 * Daily off-platform backup, invoked by Vercel Cron (see vercel.json).
 *
 * Supabase's free tier has no point-in-time recovery — the only backup is
 * whatever you take yourself. This dumps every table (same approach as
 * scripts/backup-db.mjs, run manually) and emails it as a gzipped attachment,
 * so a snapshot lands somewhere off Supabase every day without anyone having
 * to remember to run it.
 *
 * Not a substitute for real PITR — this is "yesterday's snapshot in an inbox,"
 * not "restore to any second." Good enough to recover from an accidental
 * delete or a bad migration; not good enough for a compliance requirement.
 *
 * Auth: same Authorization: Bearer <CRON_SECRET> pattern as /api/cron/daily.
 */
function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.WHATSAPP_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 })
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const recipient = process.env.BACKUP_EMAIL_TO || process.env.SMTP_USER
  if (!recipient) {
    return NextResponse.json({ error: "No backup recipient configured (BACKUP_EMAIL_TO or SMTP_USER)" }, { status: 503 })
  }

  const prisma = new PrismaClient()
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const dump: { exportedAt: string; tables: Record<string, unknown[]> } = {
      exportedAt: new Date().toISOString(),
      tables: {},
    }
    // Binary columns are excluded: GeneratedDocument.content holds cached PDF
    // bytes that are rebuildable from the source record, and including them
    // would bloat the nightly backup email for no recovery value.
    const OMIT_COLUMNS: Record<string, Record<string, boolean>> = {
      GeneratedDocument: { content: true },
    }

    let total = 0
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1)
      const omit = OMIT_COLUMNS[model.name]
      const client = prisma as unknown as Record<
        string,
        { findMany: (args?: { omit?: Record<string, boolean> }) => Promise<unknown[]> }
      >
      const rows = await client[delegate].findMany(omit ? { omit } : undefined)
      dump.tables[model.name] = rows
      total += rows.length
    }

    const json = JSON.stringify(dump, replacer)
    const gz = gzipSync(Buffer.from(json, "utf8"))

    await sendEmailWithAttachment({
      to: recipient,
      subject: `Toothfully DB backup — ${stamp}`,
      text: `Automated daily backup.\n\n${total} rows across ${Prisma.dmmf.datamodel.models.length} tables.\nUncompressed: ${(json.length / 1024 / 1024).toFixed(2)} MB · Attached (gzip): ${(gz.length / 1024 / 1024).toFixed(2)} MB.\n\nThis is a snapshot, not point-in-time recovery. Restore is manual (see scripts/restore-db.mjs).`,
      attachment: { filename: `toothfully-backup-${stamp}.json.gz`, content: gz },
    })

    return NextResponse.json({ ok: true, rows: total, tables: Prisma.dmmf.datamodel.models.length, sizeMB: +(gz.length / 1024 / 1024).toFixed(2) })
  } catch (err) {
    console.error("[cron/backup] failed:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Backup failed" }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
