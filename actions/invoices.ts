"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import { requireRole } from "@/lib/auth"
import { invoiceService } from "@/server/services/invoice.service"

/** Bill treatment done at a visit. Doctor at the chair; reception/admin may bill on her instruction. */
export async function createInvoiceAction(
  input: unknown
): Promise<{ success?: boolean; invoiceId?: string; invoiceNo?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    const inv = await invoiceService.create(input, session.userId)
    revalidatePath(`/patients/${inv.patientId}`, "layout")
    return { success: true, invoiceId: inv.id, invoiceNo: inv.invoiceNo }
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Please check the entries." }
    return { error: err instanceof Error ? err.message : "Failed to create invoice." }
  }
}

/** Reverses a bill entered by mistake. Admin only, with a reason. */
export async function deleteInvoiceAction(
  invoiceId: string,
  reason: string,
  patientId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only an administrator can delete an invoice." }
  if (!reason.trim()) return { error: "Please give a reason." }
  try {
    await invoiceService.softDelete(invoiceId, session.userId, reason.trim().slice(0, 300))
    revalidatePath(`/patients/${patientId}`, "layout")
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete invoice." }
  }
}
