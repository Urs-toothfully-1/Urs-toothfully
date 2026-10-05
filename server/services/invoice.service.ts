import { Decimal } from "@prisma/client/runtime/library"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { computeInvoiceTotals } from "@/lib/invoice-totals"

/**
 * Treatment invoices: at a treatment visit the doctor bills what she actually
 * did (from the estimate or ad hoc) at the real price. For quote-only estimates
 * this — not the quote — is what the patient owes (see lib/estimate-owed.ts).
 */

export const createInvoiceSchema = z.object({
  estimateId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z
    .array(
      z.object({
        estimateItemId: z.string().min(1).optional(),
        treatmentName: z.string().trim().min(1, "Each line needs a treatment name").max(200),
        toothNumber: z.string().trim().max(120).optional(),
        quantity: z.number().int().min(1).max(99),
        unitRate: z.number().min(0).max(10_000_000),
      })
    )
    .min(1, "Select at least one treatment to bill")
    .max(30),
  discountValue: z.number().min(0).max(10_000_000).default(0),
  discountIsPercent: z.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
  /** A referral-points discount reward the doctor is using up on this bill. */
  redeemRewardId: z.string().min(1).optional(),
})
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

async function nextInvoiceNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await tx.invoice.findFirst({
    where: { invoiceNo: { startsWith: `INV-${year}-` } },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  })
  const next = latest ? parseInt(latest.invoiceNo.split("-")[2]) + 1 : 1
  return `INV-${year}-${String(next).padStart(5, "0")}`
}

/** Keeps Estimate.invoicedTotal equal to the sum of its live invoices. */
async function syncInvoicedTotal(tx: Prisma.TransactionClient, estimateId: string) {
  const agg = await tx.invoice.aggregate({ where: { estimateId, isDeleted: false }, _sum: { total: true } })
  await tx.estimate.update({ where: { id: estimateId }, data: { invoicedTotal: agg._sum.total ?? new Decimal(0) } })
}

export const invoiceService = {
  async create(raw: unknown, createdById: string) {
    const input = createInvoiceSchema.parse(raw)
    const estimate = await prisma.estimate.findUnique({
      where: { id: input.estimateId },
      select: { id: true, patientId: true, branchId: true, invoiceBilling: true, isDeleted: true, status: true },
    })
    if (!estimate || estimate.isDeleted) throw new Error("Estimate not found")
    if (!estimate.invoiceBilling) {
      throw new Error("This is an older estimate billed by its total — collect payment against it instead of invoicing.")
    }
    if (estimate.status !== "ACTIVE") throw new Error("This estimate is no longer active.")

    const totals = computeInvoiceTotals(input.items, input.discountValue, input.discountIsPercent)

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNo = await nextInvoiceNo(tx)
      const created = await tx.invoice.create({
        data: {
          invoiceNo,
          estimateId: estimate.id,
          patientId: estimate.patientId,
          branchId: estimate.branchId,
          visitId: input.visitId,
          invoiceDate: input.invoiceDate ? new Date(`${input.invoiceDate}T12:00:00Z`) : undefined,
          subtotal: new Decimal(totals.subtotal),
          discountValue: new Decimal(input.discountValue),
          discountIsPercent: input.discountIsPercent,
          discountAmount: new Decimal(totals.discountAmount),
          total: new Decimal(totals.total),
          notes: input.notes || undefined,
          createdById,
          items: {
            create: input.items.map((it, i) => ({
              estimateItemId: it.estimateItemId,
              treatmentName: it.treatmentName,
              toothNumber: it.toothNumber || undefined,
              quantity: it.quantity,
              unitRate: new Decimal(it.unitRate),
              amount: new Decimal(Math.round(it.quantity * it.unitRate * 100) / 100),
              sortOrder: i,
            })),
          },
        },
      })
      await syncInvoicedTotal(tx, estimate.id)

      if (input.redeemRewardId) {
        // Only this patient's own, unused reward — and only once.
        const used = await tx.referralRedemption.updateMany({
          where: { id: input.redeemRewardId, patientId: estimate.patientId, usedAt: null },
          data: { usedAt: new Date(), invoiceId: created.id, usedNote: `Used on ${invoiceNo}` },
        })
        if (used.count === 0) throw new Error("That referral reward is not available to use.")
      }
      return created
    })

    await createAuditLog({
      entityType: "Invoice",
      entityId: invoice.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { invoiceNo: invoice.invoiceNo, total: totals.total, items: input.items.length },
      branchId: estimate.branchId,
    })
    return invoice
  },

  async softDelete(id: string, deletedById: string, reason: string) {
    const inv = await prisma.invoice.findUnique({ where: { id }, select: { id: true, estimateId: true, isDeleted: true, invoiceNo: true, branchId: true } })
    if (!inv || inv.isDeleted) throw new Error("Invoice not found")
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason: reason },
      })
      await syncInvoicedTotal(tx, inv.estimateId)
      // A reward used on this bill becomes available again.
      await tx.referralRedemption.updateMany({
        where: { invoiceId: id },
        data: { usedAt: null, invoiceId: null, usedNote: null },
      })
    })
    await createAuditLog({
      entityType: "Invoice",
      entityId: id,
      action: "DELETE",
      changedById: deletedById,
      newValues: { invoiceNo: inv.invoiceNo, reason },
      branchId: inv.branchId,
    })
  },

  /** Active quote-only estimates with their treatment lines — what can be billed now. */
  async billableEstimates(patientId: string) {
    const rows = await prisma.estimate.findMany({
      where: { patientId, isDeleted: false, status: "ACTIVE", invoiceBilling: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        estimateNo: true,
        items: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { sortOrder: "asc" },
          select: { id: true, treatmentName: true, toothNumber: true, quantity: true, unitRate: true, unitRateMax: true },
        },
      },
    })
    return rows.map((e) => ({
      id: e.id,
      estimateNo: e.estimateNo,
      items: e.items.map((i) => ({
        id: i.id,
        treatmentName: i.treatmentName,
        toothNumber: i.toothNumber,
        quantity: i.quantity,
        unitRate: Number(i.unitRate),
        unitRateMax: i.unitRateMax != null ? Number(i.unitRateMax) : null,
      })),
    }))
  },

  async listByPatient(patientId: string) {
    return prisma.invoice.findMany({
      where: { patientId, isDeleted: false },
      orderBy: { invoiceDate: "desc" },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        estimate: { select: { estimateNo: true } },
        createdBy: { select: { name: true } },
      },
    })
  },

  async getById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        patient: true,
        branch: true,
        estimate: { select: { id: true, estimateNo: true, total: true, totalMax: true, invoicedTotal: true, payments: { where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } }, select: { amount: true } } } },
        createdBy: { select: { name: true, role: true, doctorRegNo: true, signatureData: true } },
      },
    })
  },
}
