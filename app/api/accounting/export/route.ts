import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import type { AccountingStatus, PaymentMode, PaymentType } from "@prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"]
const MAX_ROWS = 20000 // ponytail: one-shot export; stream it if a period ever exceeds this

const dmy = (d: Date) =>
  d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-")

/**
 * Accounting Ledger → Excel. Uses the same filters as the page (branch, dates,
 * status, type, payment method). `ids` (comma-separated) narrows it to the
 * ticked rows. Only what's filtered/ticked goes in the file.
 */
export async function GET(request: NextRequest) {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const pick = (k: string) => {
    const v = sp.get(k)
    return v && v !== "all" ? v : undefined
  }
  const from = pick("from")
  const to = pick("to")
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 })
  }
  const mode = pick("mode")

  const { entries } = await accountingRepository.findByBranch({
    branchId: pick("branch"),
    fromDate: new Date(from),
    toDate: new Date(to + "T23:59:59"),
    status: pick("status") as AccountingStatus | undefined,
    paymentType: pick("type") as PaymentType | undefined,
    paymentMode: mode && MODES.includes(mode) ? (mode as PaymentMode) : undefined,
    pageSize: MAX_ROWS,
  })
  const ids = sp.get("ids")?.split(",").filter(Boolean)
  const rows = ids?.length ? entries.filter((e) => ids.includes(e.id)) : entries

  const wb = new ExcelJS.Workbook()
  wb.creator = "Ur's Toothfully"
  const ws = wb.addWorksheet("Payments")
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Patient ID", key: "pid", width: 16 },
    { header: "Patient", key: "name", width: 26 },
    { header: "Type", key: "type", width: 14 },
    { header: "Payment Method", key: "mode", width: 16 },
    { header: "Amount (₹)", key: "amount", width: 14 },
    { header: "Txn Ref", key: "ref", width: 20 },
    { header: "Receipt No", key: "receipt", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Branch", key: "branch", width: 16 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const e of rows) {
    ws.addRow({
      date: dmy(e.entryDate),
      pid: e.patient.patientId,
      name: e.patient.fullName,
      type: e.paymentType,
      mode: e.paymentMode.replace("_", " "),
      amount: Number(e.amount),
      ref: e.payment?.transactionRef ?? "",
      receipt: e.payment?.receipt?.receiptNo ?? "",
      status: e.status.replace("_", " "),
      branch: e.branch.name,
    })
  }
  const total = rows.reduce((s, e) => s + Number(e.amount), 0)
  ws.addRow({ name: `TOTAL (${rows.length} payments)`, amount: total }).font = { bold: true }
  ws.getColumn("amount").numFmt = "#,##0.00"

  const buf = await wb.xlsx.writeBuffer()
  const tag = mode ? `_${mode.toLowerCase()}` : ""
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payments${tag}_${from}_to_${to}.xlsx"`,
    },
  })
}
