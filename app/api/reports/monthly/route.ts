import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getMonthlyRevenue } from "@/lib/reports/monthly-revenue"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const now = new Date()
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()))
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1))
    const branchId = searchParams.get("branch") || undefined
    const data = await getMonthlyRevenue(year, month, branchId)
    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { year, month, branchId }, data })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
