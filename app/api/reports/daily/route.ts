import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getDailyRevenue } from "@/lib/reports/daily-revenue"
import { istTodayStr, isValidDateStr } from "@/lib/ist"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const raw = searchParams.get("date") ?? undefined
    const dateStr = isValidDateStr(raw) ? raw : istTodayStr()
    const branchId = searchParams.get("branch") || undefined
    const basis = searchParams.get("basis") === "entry" ? "entry" : "receipt"
    const data = await getDailyRevenue(dateStr, branchId, basis)
    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { date: dateStr, branchId, basis }, data })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
