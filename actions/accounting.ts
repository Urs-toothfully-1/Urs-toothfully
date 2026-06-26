"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { createAuditLog } from "@/lib/audit"

export type AccountingActionState = {
  success?: boolean
  error?: string
}

export async function approveEntryAction(
  entryId: string
): Promise<AccountingActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  try {
    const entry = await accountingRepository.findById(entryId)
    if (!entry) return { error: "Entry not found" }
    if (entry.status !== "PENDING_REVIEW") return { error: "Entry is not pending review" }

    await accountingRepository.approve(entryId)
    await createAuditLog({
      entityType: "AccountingEntry",
      entityId: entryId,
      action: "APPROVE",
      changedById: session.userId,
      newValues: { status: "APPROVED" },
    })

    revalidatePath("/admin/accounting")
    return { success: true }
  } catch {
    return { error: "Failed to approve entry" }
  }
}

export async function deleteEntryAction(
  entryId: string,
  reason: string
): Promise<AccountingActionState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  if (!reason?.trim()) return { error: "Reason is required" }

  try {
    const entry = await accountingRepository.findById(entryId)
    if (!entry) return { error: "Entry not found" }
    if (entry.status === "EXPORTED") return { error: "Cannot delete exported entries" }

    await accountingRepository.softDelete(entryId, session.userId, reason)
    await createAuditLog({
      entityType: "AccountingEntry",
      entityId: entryId,
      action: "DELETE",
      changedById: session.userId,
      previousValues: { amount: Number(entry.amount), paymentType: entry.paymentType },
      reason,
    })

    revalidatePath("/admin/accounting")
    return { success: true }
  } catch {
    return { error: "Failed to delete entry" }
  }
}
