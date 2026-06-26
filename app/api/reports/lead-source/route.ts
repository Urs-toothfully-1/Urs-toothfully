import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { getLeadSourceReport } from "@/lib/reports/lead-source"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl
    const now = new Date()
    const from = searchParams.get("from") ?? new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
    const to = searchParams.get("to") ?? now.toISOString().split("T")[0]
    const data = await getLeadSourceReport(new Date(from), new Date(to + "T23:59:59"))
    return NextResponse.json({ generatedAt: new Date().toISOString(), filters: { from, to }, data })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
