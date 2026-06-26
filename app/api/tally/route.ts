import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const branchId = searchParams.get("branch") || undefined
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "from and to dates are required" }, { status: 400 })
    }
    if (!fromStr || isNaN(Date.parse(fromStr)) || isNaN(Date.parse(toStr))) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    const entries = await accountingRepository.findForExport({
      branchId,
      fromDate: new Date(fromStr),
      toDate: new Date(toStr + "T23:59:59"),
    })

    const total = entries.reduce((s, e) => s + Number(e.amount), 0)

    return NextResponse.json({ entries, total, count: entries.length })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
