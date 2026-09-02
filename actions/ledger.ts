"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { requireRole } from "@/lib/auth"
import { ledgerRepository } from "@/server/repositories/ledger.repository"
import { createAuditLog } from "@/lib/audit"

export type LedgerFormState = { success?: boolean; error?: string }

const CATEGORIES = ["PURCHASE", "PETTY_CASH", "SALARY", "RENT", "UTILITIES", "EQUIPMENT", "LAB", "MAINTENANCE", "MARKETING", "OTHER"] as const
const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"] as const

const schema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  category: z.enum(CATEGORIES),
  direction: z.enum(["IN", "OUT"]).default("OUT"),
  amount: z.coerce.number().positive("Amount must be greater than 0.").finite(),
  paymentMode: z.enum(MODES).default("CASH"),
  payee: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  // base64 data URL of the bill photo — capped so a huge image can't bloat the row.
  attachmentData: z.string().startsWith("data:image/").max(2_000_000, "Bill image is too large (max ~1.5 MB).").optional(),
})

export async function createLedgerEntryAction(input: unknown): Promise<LedgerFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid entry." }
  const d = parsed.data

  try {
    const entry = await ledgerRepository.create({
      branchId: d.branchId,
      entryDate: new Date(`${d.entryDate}T00:00:00`),
      direction: d.direction,
      category: d.category,
      amount: new Prisma.Decimal(d.amount),
      paymentMode: d.paymentMode,
      payee: d.payee || undefined,
      notes: d.notes || undefined,
      attachmentData: d.attachmentData || undefined,
      createdById: session.userId,
    })

    await createAuditLog({
      entityType: "LedgerEntry",
      entityId: entry.id,
      action: "CREATE",
      changedById: session.userId,
      newValues: { category: d.category, amount: d.amount, direction: d.direction, payee: d.payee },
      branchId: d.branchId,
    })

    revalidatePath("/admin/accounts")
    return { success: true }
  } catch {
    return { error: "Failed to save the entry. Please try again." }
  }
}

export async function getLedgerAttachmentAction(id: string): Promise<{ data?: string; error?: string }> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  const data = await ledgerRepository.getAttachment(id)
  return data ? { data } : { error: "No bill attached." }
}

export async function deleteLedgerEntryAction(id: string, reason: string): Promise<LedgerFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  if (!reason.trim()) return { error: "A reason is required to delete an entry." }

  try {
    const before = await ledgerRepository.findById(id)
    if (!before) return { error: "Entry not found." }
    await ledgerRepository.softDelete(id, session.userId, reason.trim())

    await createAuditLog({
      entityType: "LedgerEntry",
      entityId: id,
      action: "DELETE",
      changedById: session.userId,
      previousValues: { category: before.category, amount: Number(before.amount) },
      newValues: { deletionReason: reason.trim() },
      branchId: before.branchId,
    })

    revalidatePath("/admin/accounts")
    return { success: true }
  } catch {
    return { error: "Failed to delete the entry." }
  }
}
