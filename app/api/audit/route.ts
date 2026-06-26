import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { auditRepository } from "@/server/repositories/audit.repository"
import { AuditAction } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN"])
    const { searchParams } = request.nextUrl

    const result = await auditRepository.findAll({
      entityType: searchParams.get("entityType") || undefined,
      action: (searchParams.get("action") as AuditAction) || undefined,
      changedById: searchParams.get("userId") || undefined,
      fromDate: searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined,
      toDate: searchParams.get("to") ? new Date(searchParams.get("to")! + "T23:59:59") : undefined,
      page: parseInt(searchParams.get("page") ?? "1"),
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
