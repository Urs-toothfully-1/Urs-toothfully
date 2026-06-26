import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { createAuditLog } from "@/lib/audit"

type Params = { params: Promise<{ entryId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { entryId } = await params
    const { notes } = await request.json()

    const before = await accountingRepository.findById(entryId)
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (before.status === "EXPORTED") {
      return NextResponse.json({ error: "Exported entries cannot be edited" }, { status: 400 })
    }

    await accountingRepository.updateNotes(entryId, notes ?? "")
    await createAuditLog({
      entityType: "AccountingEntry",
      entityId: entryId,
      action: "UPDATE",
      changedById: session.userId,
      previousValues: { notes: before.notes },
      newValues: { notes },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { entryId } = await params
    const { reason } = await request.json()

    if (!reason?.trim()) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    const entry = await accountingRepository.findById(entryId)
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (entry.status === "EXPORTED") {
      return NextResponse.json({ error: "Exported entries cannot be deleted" }, { status: 400 })
    }

    await accountingRepository.softDelete(entryId, session.userId, reason)
    await createAuditLog({
      entityType: "AccountingEntry",
      entityId: entryId,
      action: "DELETE",
      changedById: session.userId,
      previousValues: { amount: entry.amount, paymentType: entry.paymentType },
      reason,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
