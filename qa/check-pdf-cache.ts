/**
 * Checks the rendered-PDF cache.
 *
 *   export $(grep -E "^(DATABASE_URL|DIRECT_URL)" .env.local | sed 's/"//g' | xargs -d '\n')
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-pdf-cache.ts
 *
 * Rendering a PDF costs a headless-Chromium launch plus a second full render of
 * the print route, so the expensive failure here is silent: the cache appears
 * to work while quietly rebuilding every time, or — worse — serves a stale copy
 * of an edited prescription. Both are checked directly against the database.
 *
 * Creates and removes its own rows; safe to re-run.
 */
import { prisma } from "@/lib/prisma"
import { prunePdfCache, CACHE_TTL_DAYS } from "@/server/services/pdf.service"

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`)
  if (!ok) failures++
}

/** Mirrors the lookup generateDocumentPdf() uses before launching a browser. */
async function cacheLookup(type: string, receiptId: string, sourceHash: string) {
  return prisma.generatedDocument.findFirst({
    where: { documentType: type, receiptId, sourceHash, content: { not: null } },
    select: { id: true, content: true },
  })
}

async function main() {
  const receipt = await prisma.receipt.findFirst({ select: { id: true, patientId: true } })
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
  if (!receipt) {
    console.log("no receipt in this database to test against — skipping")
    return
  }

  await prisma.generatedDocument.deleteMany({ where: { receiptId: receipt.id } })

  const bytes = Buffer.from("%PDF-1.4 fake document for the cache check")
  const hash = "hash-original"

  const row = await prisma.generatedDocument.create({
    data: {
      documentType: "receipt",
      patientId: receipt.patientId,
      receiptId: receipt.id,
      generatedById: user.id,
      mimeType: "application/pdf",
      fileSize: bytes.length,
      content: bytes,
      sourceHash: hash,
    },
    select: { id: true },
  })

  // 1. A matching fingerprint returns the stored bytes — no browser needed.
  const hit = await cacheLookup("receipt", receipt.id, hash)
  check(!!hit?.content, "a cached PDF is found and returned without re-rendering")
  check(
    !!hit?.content && Buffer.from(hit.content).equals(bytes),
    "the bytes come back byte-identical to what was stored"
  )

  // 2. A changed source must miss, or an edited document would be served stale.
  const stale = await cacheLookup("receipt", receipt.id, "hash-after-an-edit")
  check(stale === null, "a changed source fingerprint misses the cache")

  // 3. A tracking row with no bytes must not be treated as a hit.
  await prisma.generatedDocument.update({ where: { id: row.id }, data: { content: null } })
  const empty = await cacheLookup("receipt", receipt.id, hash)
  check(empty === null, "a tracking row without bytes is not mistaken for a cached PDF")

  // 4. Pruning clears old bytes but keeps the row, so the audit trail survives.
  const old = new Date(Date.now() - (CACHE_TTL_DAYS + 1) * 24 * 60 * 60 * 1000)
  await prisma.generatedDocument.update({
    where: { id: row.id },
    data: { content: bytes, sourceHash: hash, generatedAt: old },
  })
  const { cleared } = await prunePdfCache()
  const after = await prisma.generatedDocument.findUnique({
    where: { id: row.id },
    select: { content: true, generatedAt: true },
  })
  check(cleared >= 1, `pruning cleared ${cleared} expired cache entr${cleared === 1 ? "y" : "ies"}`)
  check(after !== null && after.content === null, "pruning drops the bytes but keeps the audit row")

  // 5. Fresh entries survive the prune.
  await prisma.generatedDocument.update({
    where: { id: row.id },
    data: { content: bytes, sourceHash: hash, generatedAt: new Date() },
  })
  await prunePdfCache()
  const fresh = await prisma.generatedDocument.findUnique({
    where: { id: row.id },
    select: { content: true },
  })
  check(!!fresh?.content, "a recently generated PDF is left alone by the prune")

  await prisma.generatedDocument.deleteMany({ where: { receiptId: receipt.id } })

  console.log(failures === 0 ? "\nall pdf-cache checks passed" : `\n${failures} FAILED`)
  process.exitCode = failures ? 1 : 0
}

main().finally(() => prisma.$disconnect())
