import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { queueRepository } from "@/server/repositories/queue.repository"

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const { searchParams } = request.nextUrl
    // Non-ADMIN roles may only access their own branch
    const branchId = session.role === "ADMIN"
      ? (searchParams.get("branch") ?? session.branchId)
      : session.branchId
    const dateStr = searchParams.get("date")
    const date = dateStr && !isNaN(Date.parse(dateStr)) ? new Date(dateStr) : new Date()

    const entries = await queueRepository.findByBranchAndDate(branchId, date)
    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
