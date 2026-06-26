import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { createAuditLog } from "@/lib/audit"

type Params = { params: Promise<{ entryId: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { entryId } = await params

    const entry = await accountingRepository.findById(entryId)
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (entry.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Entry is not in PENDING_REVIEW status" }, { status: 400 })
    }

    await accountingRepository.approve(entryId)
    await createAuditLog({
      entityType: "AccountingEntry",
      entityId: entryId,
      action: "APPROVE",
      changedById: session.userId,
      newValues: { status: "APPROVED" },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
