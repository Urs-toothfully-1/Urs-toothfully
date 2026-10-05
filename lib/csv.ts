/** CSV write + read, shared by the patient export and the potential-client import. */

/** One cell. Quotes when needed; neutralises spreadsheet formulas (=, +, -, @) in text. */
export function csvEscape(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v)
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens ₹ and non-English names correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n")
}

/** RFC-4180-ish parser: quoted fields, escaped quotes, commas/newlines in quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") { row.push(field); field = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(field); rows.push(row); row = []; field = ""
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

// demo(): runnable self-check (npx tsx lib/csv.ts).
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  ok(csvEscape('a,"b"') === '"a,""b"""', "quote escape")
  ok(csvEscape("=SUM(A1)") === "'=SUM(A1)" && csvEscape("-500") === "-500", "formula guard")
  const rows = parseCsv('﻿Name,Mobile\r\n"Das, Priya",9830012345\n"He said ""hi""",98\n\n')
  ok(rows.length === 3 && rows[1][0] === "Das, Priya" && rows[2][0] === 'He said "hi"', "parse")
  ok(parseCsv(toCsv(["a"], [["x,y"]]))[1][0] === "x,y", "round trip")
  console.log("csv OK")
}
