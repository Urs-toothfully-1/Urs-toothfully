import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getDailyRevenue } from "@/lib/reports/daily-revenue"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const dateStr = searchParams.get("date") ?? new Date().toISOString().split("T")[0]
    const branchId = searchParams.get("branch") || undefined
    const data = await getDailyRevenue(new Date(dateStr), branchId)
    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { date: dateStr, branchId }, data })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
