"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/auth"
import { paymentService } from "@/server/services/payment.service"
import { PRODUCT_CATEGORIES } from "@/lib/template-options"

const productItemSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  category: z.enum(PRODUCT_CATEGORIES),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().positive("Price must be greater than 0").max(1_000_000),
})

// IDs are validated as non-empty, not as UUIDs: branch ids in this system are
// readable keys like "branch-outram-0000-0000-000000000001", so a uuid()
// constraint rejects every real branch. The database enforces the references,
// and the branch is re-checked against the session below.
const productInvoiceSchema = z.object({
  patientId: z.string().min(1),
  branchId: z.string().min(1),
  items: z.array(productItemSchema).min(1, "Add at least one product").max(20),
  mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
  transactionRef: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(300).optional(),
})

export type ProductInvoiceInput = z.infer<typeof productInvoiceSchema>

/**
 * Bills non-treatment items (X-ray, lab tests, supplies) and issues a receipt.
 *
 * Goes through paymentService like every other collection, so it gets a real
 * RCP-<year>-<seq> receipt number and an accounting entry — a product sale
 * booked outside that pipeline is invisible to the day book and Tally export.
 * Typed PRODUCT so it never lands in treatment revenue.
 */
export async function createProductInvoiceAction(
  input: unknown
): Promise<{ success: boolean; receiptId?: string; receiptNo?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { success: false, error: "Only reception or admin can bill products." }

  const parsed = productInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the entries." }
  }
  const { patientId, branchId, items, mode, transactionRef, notes } = parsed.data

  // Branch is taken from the session, not the client — a posted branchId must
  // not let one branch book revenue against another.
  if (branchId !== session.branchId) {
    return { success: false, error: "Cannot bill against another branch." }
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  // Round to paise so floating-point cents never reach the Decimal column.
  const amount = Math.round(total * 100) / 100
  if (amount <= 0) return { success: false, error: "Invoice total must be greater than 0." }

  // The itemisation lives in the human-readable note so it prints on the
  // receipt and reads correctly in the ledger.
  const lines = items.map(
    (i) => `${i.name} (${i.category}) × ${i.quantity} @ ₹${i.unitPrice}`
  )
  const description = [lines.join("; "), notes].filter(Boolean).join(" — ").slice(0, 500)

  try {
    const { receipt } = await paymentService.create(
      {
        paymentType: "PRODUCT",
        patientId,
        branchId: session.branchId,
        amount,
        mode,
        transactionRef: transactionRef || undefined,
        notes: description,
      },
      session.userId
    )

    revalidatePath(`/patients/${patientId}/payments`, "page")
    revalidatePath(`/patients/${patientId}/documents`, "page")
    return { success: true, receiptId: receipt.id, receiptNo: receipt.receiptNo }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create product invoice.",
    }
  }
}
