/**
 * Builds the correction worksheet for spreadsheet rows the import had to skip
 * because the phone number was unusable.
 *
 *   npx ts-node --transpile-only -r tsconfig-paths/register qa/rejected-phones-csv.ts <raw.json> <out.csv>
 *
 * Includes every other detail the sheets carried, so the clinic can recognise
 * the patient, plus an empty CORRECTED_MOBILE column to fill in. Re-running the
 * importer afterwards picks them up — it dedupes on mobile, so nobody is added
 * twice.
 */
import { writeFileSync } from "node:fs"
import { collect, cleanMobile, type Row } from "./import-patients"
import { validateMobile } from "@/lib/whatsapp/phone"

const BRANCH_LABEL: Record<string, string> = {
  outram: "Outram",
  alipore: "New Alipore",
  saltlake: "Salt Lake",
}

/**
 * Some cells hold two numbers ("9831417427/9903642047"). The first valid one is
 * pre-filled so reception only has to confirm it rather than chase the patient.
 */
function splitCandidate(raw: string): string | undefined {
  const parts = raw.split(/[/,;&]| or /i).map(cleanMobile).filter(Boolean)
  return parts.find((p) => validateMobile(p).valid)
}

/** Why the app's own validator refused the number, in words reception can act on. */
function problem(raw: string, digits: string): string {
  const candidate = splitCandidate(raw)
  if (candidate) return `Two numbers in one cell — first one pre-filled, please confirm`
  if (!digits) return "No number in the sheet — ask the patient"
  if (digits.length < 10) return `Only ${digits.length} digits — ${10 - digits.length} missing`
  if (digits.length > 10) return `${digits.length} digits — ${digits.length - 10} too many`
  if (!/^[6-9]/.test(digits)) return `Starts with ${digits[0]} — Indian mobiles start 6-9`
  return validateMobile(digits).error ?? "Rejected by validation"
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`

function main() {
  const [rawJson, out] = process.argv.slice(2)
  if (!rawJson || !out) throw new Error("usage: rejected-phones-csv.ts <raw.json> <out.csv>")

  const rejected: (Row & { digits: string })[] = []
  const seen = new Set<string>()

  for (const r of collect(rawJson)) {
    if (r.fullName.length < 2 || /[<>]/.test(r.fullName)) continue
    const digits = cleanMobile(r.mobileRaw)
    if (validateMobile(digits).valid) continue
    // The same broken row appears in more than one sheet; list each person once.
    const key = `${r.fullName.toLowerCase().replace(/\s+/g, " ")}|${digits}`
    if (seen.has(key)) continue
    seen.add(key)
    rejected.push({ ...r, digits })
  }

  // Rows needing real research first; the pre-filled ones sink to the bottom.
  rejected.sort((a, b) => {
    const aPre = splitCandidate(a.mobileRaw) ? 1 : 0
    const bPre = splitCandidate(b.mobileRaw) ? 1 : 0
    return (
      aPre - bPre ||
      (BRANCH_LABEL[a.branchKey] ?? a.branchKey).localeCompare(BRANCH_LABEL[b.branchKey] ?? b.branchKey) ||
      a.fullName.localeCompare(b.fullName)
    )
  })

  const header = [
    "CORRECTED_MOBILE (fill this in)",
    "Branch",
    "Patient name",
    "Number as written in the sheet",
    "What is wrong",
    "Age",
    "Gender",
    "Date of birth",
    "Email",
    "Address",
    "Source file",
  ]

  const lines = [
    header.map(csvCell).join(","),
    ...rejected.map((r) =>
      [
        splitCandidate(r.mobileRaw) ?? "",
        BRANCH_LABEL[r.branchKey] ?? r.branchKey,
        r.fullName.replace(/\s+/g, " "),
        r.mobileRaw,
        problem(r.mobileRaw, r.digits),
        r.age ?? "",
        r.gender ?? "",
        r.dob ?? "",
        r.email ?? "",
        r.address ?? "",
        r.source,
      ]
        .map(csvCell)
        .join(",")
    ),
  ]

  // BOM so Excel opens the file as UTF-8 and keeps Bengali/accented names intact.
  writeFileSync(out, "﻿" + lines.join("\r\n") + "\r\n", "utf8")

  const byBranch = rejected.reduce<Record<string, number>>((a, r) => {
    const k = BRANCH_LABEL[r.branchKey] ?? r.branchKey
    a[k] = (a[k] ?? 0) + 1
    return a
  }, {})
  const preFilled = rejected.filter((r) => splitCandidate(r.mobileRaw)).length
  console.log(`${rejected.length} patients need a corrected phone number`)
  for (const [b, n] of Object.entries(byBranch)) console.log(`  ${b.padEnd(12)} ${n}`)
  console.log(`\n  ${preFilled} pre-filled (two numbers in one cell) — just confirm`)
  console.log(`  ${rejected.length - preFilled} need the real number looked up`)
  console.log(`\n→ ${out}`)
}

main()
