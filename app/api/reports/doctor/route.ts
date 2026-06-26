import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getDoctorRevenue } from "@/lib/reports/doctor-revenue"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const now = new Date()
    const from = searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    const to = searchParams.get("to") ?? now.toISOString().split("T")[0]
    const branchId = searchParams.get("branch") || undefined
    const data = await getDoctorRevenue(new Date(from), new Date(to + "T23:59:59"), branchId)
    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { from, to, branchId }, data })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
