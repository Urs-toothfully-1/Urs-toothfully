import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { prisma } from "@/lib/prisma"
import { generateExportBatchNo } from "@/lib/id-generator"
import { createAuditLog } from "@/lib/audit"

function escapeCsv(value: string | number | null | undefined): string {
  let str = String(value ?? "")
  // Formula-injection guard: a cell starting with = + - @ (or a leading
  // tab/CR) is treated as a formula by Excel/Sheets. Patient names come from
  // the public intake form, so neutralise them with a leading apostrophe.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function formatDate(date: Date | string): string {
  const d = new Date(date)
  const dd = String(d.getDate()).padStart(2, "0")
  const mmm = MONTHS[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd}-${mmm}-${yyyy}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"])
    const body = await request.json()
    const { branchId, fromDate, toDate, format = "CSV" } = body

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "fromDate and toDate are required" }, { status: 400 })
    }
    if (isNaN(Date.parse(fromDate)) || isNaN(Date.parse(toDate))) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }
    if (!["CSV", "EXCEL"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use CSV or EXCEL." }, { status: 400 })
    }

    const entries = await accountingRepository.findForExport({
      branchId: branchId || undefined,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate + "T23:59:59"),
    })

    if (entries.length === 0) {
      return NextResponse.json({ error: "No approved entries found for this period" }, { status: 404 })
    }

    // Generate CSV
    const headers = [
      "Date", "Receipt No", "Patient Name", "Patient ID",
      "Payment Type", "Mode", "Transaction Ref", "Amount (₹)",
      "Branch", "Notes",
    ]

    const rows = entries.map((e) => [
      formatDate(e.entryDate),
      e.payment?.receipt?.receiptNo ?? "",
      e.patient.fullName,
      e.patient.patientId,
      e.paymentType,
      e.paymentMode,
      e.payment?.transactionRef ?? "",
      Number(e.amount).toFixed(2),
      e.branch.name,
      e.notes ?? "",
    ])

    const csvLines = [headers, ...rows].map((row) => row.map(escapeCsv).join(","))
    const csvContent = "﻿" + csvLines.join("\r\n") // BOM for Excel

    // Create ExportBatch record
    const batchNo = await generateExportBatchNo()
    const exportBatch = await prisma.exportBatch.create({
      data: {
        batchNo,
        branchId: branchId || (await prisma.branch.findFirst({ select: { id: true } }))!.id,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        exportedById: session.userId,
        recordCount: entries.length,
        format: format as "CSV" | "EXCEL",
      },
    })

    // Mark entries as EXPORTED
    await accountingRepository.markExported(
      entries.map((e) => e.id),
      exportBatch.id
    )

    await createAuditLog({
      entityType: "ExportBatch",
      entityId: exportBatch.id,
      action: "EXPORT",
      changedById: session.userId,
      newValues: { batchNo, recordCount: entries.length, format },
      branchId,
    })

    const filename = `tally-export-${batchNo}-${formatDate(new Date())}.csv`

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Batch-No": batchNo,
        "X-Record-Count": String(entries.length),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
