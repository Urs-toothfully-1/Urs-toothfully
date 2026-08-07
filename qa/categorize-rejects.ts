/** Buckets the rejected phone rows so it's clear which need a human. */
import { collect, cleanMobile } from "./import-patients"
import { validateMobile } from "@/lib/whatsapp/phone"

const rows = collect(process.argv[2])
const seen = new Set<string>()
const bad: { name: string; raw: string; digits: string }[] = []
for (const r of rows) {
  if (r.fullName.length < 2) continue
  const digits = cleanMobile(r.mobileRaw)
  if (validateMobile(digits).valid) continue
  const key = `${r.fullName.toLowerCase()}|${digits}`
  if (seen.has(key)) continue
  seen.add(key)
  bad.push({ name: r.fullName, raw: r.mobileRaw, digits })
}

const twoNumbers: string[] = []
const blank: string[] = []
const short: string[] = []
const long: string[] = []
const other: string[] = []

for (const r of bad) {
  const parts = r.raw.split(/[/,;&]| or /i).map(cleanMobile).filter(Boolean)
  const usable = parts.filter((p) => validateMobile(p).valid)
  if (usable.length) twoNumbers.push(`${r.name}  "${r.raw}"  →  ${usable[0]}`)
  else if (!r.digits) blank.push(r.name)
  else if (r.digits.length < 10) short.push(`${r.name}  ${r.digits}`)
  else if (r.digits.length > 10) long.push(`${r.name}  ${r.digits}`)
  else other.push(`${r.name}  ${r.digits}`)
}

console.log(`total rejected            ${bad.length}`)
console.log(`  two numbers in one cell ${twoNumbers.length}   (recoverable automatically)`)
console.log(`  no number at all        ${blank.length}`)
console.log(`  too few digits          ${short.length}`)
console.log(`  too many digits         ${long.length}`)
console.log(`  other                   ${other.length}`)
console.log("\nRecoverable examples:")
twoNumbers.slice(0, 6).forEach((x) => console.log("  " + x))
console.log("\nToo few digits (examples):")
short.slice(0, 4).forEach((x) => console.log("  " + x))
console.log("\nToo many digits (examples):")
long.slice(0, 4).forEach((x) => console.log("  " + x))
