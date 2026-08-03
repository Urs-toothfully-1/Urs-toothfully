/**
 * One-off importer for the clinic's historical patient spreadsheets.
 *
 *   python qa/xlsx-to-json.py "<unzipped dir>" raw.json
 *   npx ts-node --transpile-only -r tsconfig-paths/register qa/import-patients.ts raw.json [--write]
 *
 * Without --write it only reports. It reuses the app's own rules (validateMobile,
 * UNKNOWN_DOB, the PAT-YYYY-NNNNN sequence) so imported rows behave exactly like
 * rows created through the UI.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/lib/prisma"
import { validateMobile } from "@/lib/whatsapp/phone"
import { UNKNOWN_DOB } from "@/lib/patient-dob"
import type { Gender } from "@prisma/client"

interface RawFile { file: string; rows: string[][] }

/** Rows the clinic has to fix by hand land here. */
const REJECTS = process.env.REJECTS_CSV ?? "C:/Users/Asus/Desktop/Urs_toothfully/backups/import-rejected-phones.csv"

const BRANCHES: Record<string, string> = {
  outram: "branch-outram-0000-0000-000000000001",
  alipore: "branch-alipo-0000-0000-000000000002",
  saltlake: "branch-saltl-0000-0000-000000000003",
}

export interface Row {
  fullName: string
  mobileRaw: string
  branchKey: keyof typeof BRANCHES
  dob?: string
  gender?: Gender
  age?: number
  email?: string
  address?: string
  leadSource?: string
  referenceName?: string
  reasonForVisit?: string
  source: string
  history?: Record<string, unknown>
}

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim())

/** Spreadsheet phone cells arrive as "9830012345.0", "+91 98300 12345", "0447…". */
export function cleanMobile(raw: string): string {
  let d = s(raw).replace(/\.0+$/, "").replace(/[^\d]/g, "")
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2)
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  return d
}

export function parseGender(raw: string): Gender | undefined {
  const t = s(raw).toLowerCase()
  if (/\bf(emale)?\b/.test(t) || /\/f$|^f$/.test(t)) return "FEMALE"
  if (/\bm(ale)?\b/.test(t) || /\/m$|^m$/.test(t)) return "MALE"
  return undefined
}

export function parseAge(raw: string): number | undefined {
  const m = s(raw).match(/(\d{1,3})/)
  if (!m) return undefined
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 120 ? n : undefined
}

/** Sheet dates arrive as Date objects or US-style "5/13/1995" strings. */
export function parseDob(raw: unknown): string | undefined {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear()
    if (y < 1900 || y > new Date().getFullYear()) return undefined
    return raw.toISOString().slice(0, 10)
  }
  const t = s(raw)
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) {
    const [, a, b, y] = m
    const month = parseInt(a, 10)
    const day = parseInt(b, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
    const year = parseInt(y, 10)
    if (year < 1900 || year > new Date().getFullYear()) return undefined
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? iso[0] : undefined
}

function branchFromText(text: string, fallback: keyof typeof BRANCHES): keyof typeof BRANCHES {
  const t = text.toLowerCase()
  if (/salt\s*lake|saltlake|sector\s*(i{1,3}|[123])/.test(t)) return "saltlake"
  if (/new\s*alipore|alipore|alipur/.test(t)) return "alipore"
  if (/outram/.test(t)) return "outram"
  return fallback
}

const yn = (v: unknown) => /^y(es)?$/i.test(s(v))

/**
 * hepatitisType and bloodPressureType are short code columns (VarChar 10/20)
 * but the intake sheet puts free prose in them. Keep a value only when it fits;
 * the boolean beside it is what raises the medical alert anyway.
 */
const code = (v: unknown, max: number) => {
  const t = s(v)
  return t && t.length <= max ? t : undefined
}

/** Maps the New Alipore intake sheet's medical columns onto DentalHistory. */
function historyFromGoogleSheet(r: unknown[]): Record<string, unknown> {
  return {
    allergies: yn(r[8]), allergiesDetail: s(r[9]) || undefined,
    diabetes: yn(r[10]),
    hepatitis: yn(r[12]), hepatitisType: code(r[13], 10),
    epilepsy: yn(r[14]), epilepsyDetail: s(r[15]) || undefined,
    heartProblems: yn(r[16]), heartProblemsDetail: s(r[17]) || undefined,
    bloodPressure: yn(r[18]), bloodPressureType: code(r[19], 20),
    kidneyLiver: yn(r[20]),
    respiratory: yn(r[24]),
    bleedsEasily: yn(r[26]),
    pregnant: yn(r[30]),
    currentMedications: s(r[34]) || undefined,
    consentGiven: true,
  }
}

export function parseWorkbook(wb: RawFile): Row[] {
  const data = wb.rows
  const name = wb.file.toLowerCase()
  const out: Row[] = []

  // ── New Alipore intake form (rich: medical history) ──
  if (name.includes("google sheet")) {
    for (const r of data.slice(1)) {
      const fullName = s(r[1])
      if (!fullName) continue
      out.push({
        fullName,
        mobileRaw: s(r[5]),
        branchKey: "alipore",
        dob: parseDob(r[3]),
        gender: parseGender(s(r[4])),
        age: parseAge(s(r[4])),
        email: s(r[6]) || undefined,
        address: s(r[2]) || undefined,
        referenceName: s(r[7]) || undefined,
        leadSource: "Clinic Intake Form",
        source: name,
        history: historyFromGoogleSheet(r),
      })
    }
    return out
  }

  // ── Outram enquiry form (has its own branch column) ──
  if (name.includes("outram")) {
    for (const r of data.slice(1)) {
      const fullName = s(r[1])
      if (!fullName) continue
      out.push({
        fullName,
        mobileRaw: s(r[2]),
        branchKey: branchFromText(`${s(r[5])} ${s(r[3])}`, "outram"),
        dob: parseDob(r[8]),
        gender: parseGender(s(r[9])),
        email: s(r[10]) || undefined,
        address: s(r[3]) || undefined,
        leadSource: s(r[4]) || undefined,
        reasonForVisit: [s(r[6]), s(r[7])].filter(Boolean).join(" · ") || undefined,
        source: name,
      })
    }
    return out
  }

  // ── Salt Lake register: SL NO | NAME | PHONE | AGE | M/F (header on row 2) ──
  if (name.includes("saltlake pt data")) {
    for (const r of data.slice(3)) {
      const fullName = s(r[1])
      if (!fullName) continue
      out.push({
        fullName, mobileRaw: s(r[2]), branchKey: "saltlake",
        age: parseAge(s(r[3])), gender: parseGender(s(r[4])), source: name,
      })
    }
    return out
  }

  // ── Implanting Smile list: NAME | MOBILE (header on row 2) ──
  if (name.includes("implanting smile")) {
    for (const r of data.slice(3)) {
      const fullName = s(r[0])
      if (!fullName || /^name$/i.test(fullName)) continue
      out.push({ fullName, mobileRaw: s(r[1]), branchKey: "saltlake", source: name })
    }
    return out
  }

  // ── New Alipore register: NAME | AGE | MOBILE ──
  if (name.includes("newalipore patient list")) {
    for (const r of data.slice(1)) {
      const fullName = s(r[0])
      if (!fullName) continue
      out.push({
        fullName, mobileRaw: s(r[2]), branchKey: "alipore",
        age: parseAge(s(r[1])), source: name,
      })
    }
    return out
  }

  throw new Error(`No parser for ${name}`)
}

export function collect(jsonPath: string): Row[] {
  const files = JSON.parse(readFileSync(jsonPath, "utf8")) as RawFile[]
  return files.flatMap(parseWorkbook)
}

async function main() {
  const jsonPath = process.argv[2]
  const write = process.argv.includes("--write")
  const ageToDob = process.argv.includes("--age-to-dob")
  if (!jsonPath) throw new Error("usage: import-patients.ts <raw.json> [--write] [--age-to-dob]")

  const rows = collect(jsonPath)
  console.log(`Parsed ${rows.length} rows from the spreadsheets\n`)

  // ── Clean + classify ──
  const valid: (Row & { mobile: string })[] = []
  const badMobile: Row[] = []
  const badName: Row[] = []
  for (const r of rows) {
    const nameOk = r.fullName.length >= 2 && !/[<>]/.test(r.fullName)
    if (!nameOk) { badName.push(r); continue }
    const mobile = cleanMobile(r.mobileRaw)
    if (!validateMobile(mobile).valid) { badMobile.push({ ...r, mobileRaw: mobile }); continue }
    valid.push({ ...r, mobile })
  }

  // ── Dedupe within the import: keep the richest row per mobile ──
  const score = (r: Row) => (r.history ? 8 : 0) + (r.dob ? 4 : 0) + (r.email ? 2 : 0) + (r.address ? 1 : 0) + (r.gender ? 1 : 0)
  const byMobile = new Map<string, Row & { mobile: string }>()
  let dupInFile = 0
  for (const r of valid) {
    const seen = byMobile.get(r.mobile)
    if (!seen) byMobile.set(r.mobile, r)
    else { dupInFile++; if (score(r) > score(seen)) byMobile.set(r.mobile, { ...r, fullName: seen.fullName.length > r.fullName.length ? seen.fullName : r.fullName }) }
  }

  // ── Dedupe against what is already in the database ──
  const existing = await prisma.patient.findMany({ select: { mobile: true } })
  const existingMobiles = new Set(existing.map((p) => p.mobile))
  const toInsert = [...byMobile.values()].filter((r) => !existingMobiles.has(r.mobile))
  const alreadyThere = byMobile.size - toInsert.length

  const perBranch = toInsert.reduce<Record<string, number>>((a, r) => ((a[r.branchKey] = (a[r.branchKey] ?? 0) + 1), a), {})
  console.log("── Report ────────────────────────────────────")
  console.log(`  unusable name            ${badName.length}`)
  console.log(`  unusable / missing phone ${badMobile.length}`)
  console.log(`  duplicate rows merged    ${dupInFile}`)
  console.log(`  already in the database  ${alreadyThere}`)
  console.log(`  TO INSERT                ${toInsert.length}`)
  console.log(`     by branch             ${JSON.stringify(perBranch)}`)
  console.log(`     with real DOB         ${toInsert.filter((r) => r.dob).length}`)
  console.log(`     with age only         ${toInsert.filter((r) => !r.dob && r.age).length}`)
  console.log(`     with gender           ${toInsert.filter((r) => r.gender).length}`)
  console.log(`     with email            ${toInsert.filter((r) => r.email).length}`)
  console.log(`     with address          ${toInsert.filter((r) => r.address).length}`)
  console.log(`     with medical history  ${toInsert.filter((r) => r.history).length}`)
  console.log(`  existing patients in DB  ${existing.length}`)

  if (badMobile.length) {
    // Handed back to the clinic to correct — re-running the import picks them up
    // without duplicating anyone, because dedupe is by mobile against the DB.
    const csv = [
      "name,number_as_written,digits_found,branch,source_file",
      ...badMobile.map((r) =>
        [r.fullName, r.mobileRaw, r.mobileRaw.length, r.branchKey, r.source]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n")
    writeFileSync(REJECTS, csv, "utf8")
    console.log(`\n  ${badMobile.length} rows need a corrected phone number → ${REJECTS}`)
    badMobile.slice(0, 5).forEach((r) => console.log(`    ${r.fullName} → "${r.mobileRaw}" (${r.source})`))
  }

  if (!write) {
    console.log("\nDRY RUN — nothing written. Re-run with --write to import.")
    await prisma.$disconnect()
    return
  }

  // ── Insert ──
  const importer = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", isActive: true }, select: { id: true } })
  const year = new Date().getFullYear()
  const latest = await prisma.patient.findFirst({
    where: { patientId: { startsWith: `PAT-${year}-` } },
    orderBy: { patientId: "desc" },
    select: { patientId: true },
  })
  let seq = latest ? parseInt(latest.patientId.split("-")[2], 10) : 0

  let done = 0
  for (const r of toInsert) {
    seq++
    const patientId = `PAT-${year}-${String(seq).padStart(5, "0")}`
    let dateOfBirth = UNKNOWN_DOB
    if (r.dob) dateOfBirth = new Date(`${r.dob}T00:00:00.000Z`)
    else if (ageToDob && r.age) dateOfBirth = new Date(Date.UTC(year - r.age, 6, 1))

    await prisma.patient.create({
      data: {
        patientId,
        registrationBranchId: BRANCHES[r.branchKey],
        fullName: r.fullName.replace(/\s+/g, " ").slice(0, 200),
        dateOfBirth,
        gender: r.gender ?? "OTHER",
        mobile: r.mobile,
        email: r.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email) ? r.email.slice(0, 100) : undefined,
        address: r.address?.slice(0, 500) || undefined,
        leadSource: (r.leadSource ?? "Imported record").slice(0, 100),
        referenceName: r.referenceName?.slice(0, 200) || undefined,
        reasonForVisit: r.reasonForVisit?.slice(0, 1000) || undefined,
        createdById: importer.id,
        ...(r.history
          ? { dentalHistories: { create: { ...(r.history as object), createdById: importer.id, version: 1, isLatest: true } } }
          : {}),
      },
    })
    done++
    if (done % 200 === 0) console.log(`  … ${done}/${toInsert.length}`)
  }

  console.log(`\nImported ${done} patients. Database now holds ${await prisma.patient.count()}.`)
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch(async (e) => {
    console.error("FAILED:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
}
