import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LEDGER_CATEGORIES } from "@/lib/ledger-categories"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LABEL = Object.fromEntries(LEDGER_CATEGORIES.map((c) => [c.value, c.label]))
const VALID = new Set(LEDGER_CATEGORIES.map((c) => c.value))

const COLUMNS = [
  { header: "Date", key: "date", width: 14 },
  { header: "Voucher Type", key: "voucher", width: 14 },
  { header: "Ledger", key: "ledger", width: 18 },
  { header: "Payee / Vendor", key: "payee", width: 24 },
  { header: "Amount (₹)", key: "amount", width: 14 },
  { header: "Payment Mode", key: "mode", width: 16 },
  { header: "Branch", key: "branch", width: 16 },
  { header: "Notes", key: "notes", width: 30 },
]

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}` // DD-MM-YYYY, Tally-friendly
}

// Excel sheet names can't contain \ / ? * [ ] : and cap at 31 chars.
function sheetName(label: string): string {
  return label.replace(/[\\/?*[\]:]/g, "-").slice(0, 31)
}

type Row = {
  entryDate: Date
  category: string
  direction: string
  amount: Prisma.Decimal
  paymentMode: string
  payee: string | null
  notes: string | null
  branch: { name: string }
}

function fillSheet(ws: ExcelJS.Worksheet, rows: Row[]) {
  ws.columns = COLUMNS
  ws.getRow(1).font = { bold: true }
  for (const e of rows) {
    ws.addRow({
      date: ymd(e.entryDate),
      voucher: e.direction === "OUT" ? "Payment" : "Receipt",
      ledger: LABEL[e.category] ?? e.category,
      payee: e.payee ?? "",
      amount: Number(e.amount),
      mode: e.paymentMode.replace("_", " "),
      branch: e.branch.name,
      notes: e.notes ?? "",
    })
  }
  const total = rows.reduce((s, e) => s + Number(e.amount), 0)
  const totalRow = ws.addRow({ payee: "TOTAL", amount: total })
  totalRow.font = { bold: true }
  ws.getColumn("amount").numFmt = "#,##0.00"
}

/**
 * Cash-book (expense ledger) export as an Excel workbook for Tally / Excel.
 * A category filter yields a single sheet for that section; "all" yields one
 * sheet per category (empty categories omitted). Each row maps to a Tally
 * Payment voucher (expense ledger debited, the cash/bank mode credited).
 */
export async function GET(request: NextRequest) {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const branch = sp.get("branch") || undefined
  const category = sp.get("category")
  const from = sp.get("from")
  const to = sp.get("to")
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 })
  }

  const where: Prisma.LedgerEntryWhereInput = {
    isDeleted: false,
    entryDate: { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
    ...(branch ? { branchId: branch } : {}),
    ...(category && VALID.has(category) ? { category: category as never } : {}),
  }

  const entries = (await prisma.ledgerEntry.findMany({
    where,
    select: {
      entryDate: true, category: true, direction: true, amount: true,
      paymentMode: true, payee: true, notes: true,
      branch: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { entryDate: "asc" }],
  })) as Row[]

  const wb = new ExcelJS.Workbook()
  wb.creator = "Ur's Toothfully"

  if (category && VALID.has(category)) {
    // One section.
    fillSheet(wb.addWorksheet(sheetName(LABEL[category] ?? category)), entries)
  } else {
    // One sheet per category that has entries, in the defined order.
    const byCat = new Map<string, Row[]>()
    for (const e of entries) {
      const arr = byCat.get(e.category) ?? []
      arr.push(e)
      byCat.set(e.category, arr)
    }
    const ordered = LEDGER_CATEGORIES.filter((c) => byCat.has(c.value))
    if (ordered.length === 0) {
      fillSheet(wb.addWorksheet("Cash Book"), []) // empty period → still a valid file
    } else {
      for (const c of ordered) fillSheet(wb.addWorksheet(sheetName(c.label)), byCat.get(c.value)!)
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const label = category && VALID.has(category) ? `_${(LABEL[category] ?? category).toLowerCase().replace(/\W+/g, "-")}` : ""
  const fname = `cashbook${label}_${from}_to_${to}.xlsx`
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  })
}
