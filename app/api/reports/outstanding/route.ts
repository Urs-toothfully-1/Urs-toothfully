import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getOutstandingBalances } from "@/lib/reports/outstanding-balances"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const branchId = request.nextUrl.searchParams.get("branch") || undefined
    const data = await getOutstandingBalances(branchId)
    const totalOutstanding = data.reduce((s, r) => s + r.balance, 0)
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      filters: { branchId },
      summary: { count: data.length, totalOutstanding },
      data,
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
