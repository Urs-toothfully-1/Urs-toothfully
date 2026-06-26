import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { AccountingStatus, PaymentType } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl

    const branchId = searchParams.get("branch") || undefined
    const fromStr = searchParams.get("from")
    const toStr = searchParams.get("to")
    const statusStr = searchParams.get("status")
    const typeStr = searchParams.get("type")
    const page = parseInt(searchParams.get("page") ?? "1")

    const result = await accountingRepository.findByBranch({
      branchId,
      fromDate: fromStr ? new Date(fromStr) : undefined,
      toDate: toStr ? new Date(toStr + "T23:59:59") : undefined,
      status: statusStr as AccountingStatus | undefined,
      paymentType: typeStr as PaymentType | undefined,
      page,
      pageSize: 50,
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
