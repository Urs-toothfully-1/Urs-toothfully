import { Decimal } from "@prisma/client/runtime/library"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { numericSetting } from "@/lib/settings-value"
import { createAuditLog } from "@/lib/audit"
import { computeEstimateTotals } from "@/lib/estimate-totals"
import { z } from "zod"

export const estimateItemSchema = z.object({
  // Treatment IDs are slugs, not UUIDs. Absent = a custom treatment.
  treatmentId: z.string().min(1).optional(),
  treatmentName: z.string().min(1).max(200),
  // Custom treatments carry no category — default to OTHER (column is NOT NULL).
  category: z.string().max(100).default("OTHER"),
  toothNumber: z.string().max(120).optional(),
  quantity: z.number().int().positive().default(1),
  unitRate: z.number().positive(),
  // Per-line discount: a % or a ₹ amount, per discountIsPercent. Optional so
  // existing callers/scripts that don't discount can omit them.
  discountValue: z.number().min(0).optional(),
  discountIsPercent: z.boolean().optional(),
  plannedSittings: z.number().int().min(1).max(99).default(1),
  // Quoted as an option for the patient to compare; printed, never charged.
  // Absent from the schema means zod strips it and the flag never reaches the
  // database, which is exactly how it went missing the first time.
  isAlternative: z.boolean().optional(),
  sortOrder: z.number().int().default(0),
})

export const createEstimateSchema = z.object({
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  visitId: z.string().uuid(),
  // Estimate-wide discount applied on top of the per-line discounts: a % or ₹.
  globalDiscountValue: z.number().min(0).optional(),
  globalDiscountIsPercent: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: z.array(estimateItemSchema).min(1),
})

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>

async function generateNextEstimateNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await estimateRepository.getLatestEstimateNoForYear(year)
  const next = latest ? parseInt(latest.split("-")[2]) + 1 : 1
  return `EST-${year}-${String(next).padStart(5, "0")}`
}

export const estimateService = {
  async getById(id: string) {
    return estimateRepository.findById(id)
  },

  async getByPatient(patientId: string) {
    return estimateRepository.findByPatient(patientId)
  },

  async getActiveByPatient(patientId: string) {
    return estimateRepository.findActiveByPatient(patientId)
  },

  async create(input: CreateEstimateInput, doctorId: string) {
    const estimateNo = await generateNextEstimateNo()

    const items = input.items.map((item) => ({
      ...item,
      unitRate: new Decimal(item.unitRate),
      amount: new Decimal(item.quantity * item.unitRate),
      discountValue: new Decimal(item.discountValue ?? 0),
      discountIsPercent: item.discountIsPercent ?? true,
      plannedSittings: item.plannedSittings ?? 1,
    }))

    // All discount math (per-line, then global on top) lives in one shared helper.
    const totals = computeEstimateTotals(
      input.items.map((i) => ({
        quantity: i.quantity,
        unitRate: i.unitRate,
        discountValue: i.discountValue ?? 0,
        discountIsPercent: i.discountIsPercent ?? true,
        isAlternative: i.isAlternative,
      })),
      input.globalDiscountValue ?? 0,
      input.globalDiscountIsPercent ?? true
    )

    const advancePercent = await settingsRepository.get("advance_percent", input.branchId)
    const advanceRequired = totals.total * (numericSetting("advance_percent", advancePercent) / 100)

    // Nothing non-finite may reach a Decimal column — that is what turned a bad
    // setting into "Failed to save estimate" instead of a visible problem.
    for (const [label, n] of [["subtotal", totals.subtotal], ["total", totals.total], ["advance", advanceRequired]] as const) {
      if (!Number.isFinite(n)) throw new Error(`Estimate ${label} is not a valid number (${n}).`)
    }

    const estimate = await estimateRepository.create({
      estimateNo,
      patientId: input.patientId,
      branchId: input.branchId,
      doctorId,
      visitId: input.visitId,
      subtotal: new Decimal(totals.subtotal),
      total: new Decimal(totals.total),
      advanceRequired: new Decimal(advanceRequired),
      discountPercent: totals.discountPercent > 0 ? new Decimal(totals.discountPercent) : undefined,
      discountAmount: totals.discountAmount > 0 ? new Decimal(totals.discountAmount) : undefined,
      globalDiscountValue: new Decimal(input.globalDiscountValue ?? 0),
      globalDiscountIsPercent: input.globalDiscountIsPercent ?? true,
      notes: input.notes,
      // Noon UTC so the @db.Date column keeps the intended calendar day regardless
      // of the DB/session timezone (local-midnight shifts a day back — a known trap here).
      documentDate: input.documentDate ? new Date(`${input.documentDate}T12:00:00Z`) : undefined,
      items,
    })

    await createAuditLog({
      entityType: "Estimate",
      entityId: estimate.id,
      action: "CREATE",
      changedById: doctorId,
      newValues: { estimateNo, total: totals.total, itemCount: items.length },
      branchId: input.branchId,
    })

    // Auto-create the visit prescription from this estimate (patient details,
    // dental-history alerts, treatments without prices). Non-fatal: the doctor
    // page lazily creates it too if this fails.
    try {
      const { prescriptionService } = await import("@/server/services/prescription.service")
      await prescriptionService.createFromEstimate(estimate.id, doctorId)
    } catch (err) {
      console.error("Auto-prescription creation failed:", err)
    }

    return estimate
  },

  /**
   * Prescription-first entry: ensures an ACTIVE estimate exists for the visit
   * (empty if new) plus its auto-created prescription, and returns the estimate id.
   */
  async ensureForVisit(input: { patientId: string; branchId: string; visitId: string }, doctorId: string) {
    const existing = await estimateRepository.findByVisit(input.visitId)
    if (existing) return existing.id

    const estimateNo = await generateNextEstimateNo()
    const estimate = await estimateRepository.createEmpty({
      estimateNo,
      patientId: input.patientId,
      branchId: input.branchId,
      doctorId,
      visitId: input.visitId,
    })

    await createAuditLog({
      entityType: "Estimate",
      entityId: estimate.id,
      action: "CREATE",
      changedById: doctorId,
      newValues: { estimateNo, total: 0, itemCount: 0 },
      branchId: input.branchId,
    })

    try {
      const { prescriptionService } = await import("@/server/services/prescription.service")
      await prescriptionService.createFromEstimate(estimate.id, doctorId)
    } catch (err) {
      console.error("Auto-prescription creation failed:", err)
    }

    return estimate.id
  },

  async updateItemSittings(
    itemId: string,
    data: { plannedSittings?: number; completedSittings?: number; status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" },
    updatedById: string
  ) {
    const item = await estimateRepository.updateItemSittings(itemId, { ...data, updatedById })
    await createAuditLog({
      entityType: "EstimateItem",
      entityId: itemId,
      action: "STATUS_CHANGE",
      changedById: updatedById,
      newValues: { ...data },
    })
    return item
  },

  async updateItemStatus(
    itemId: string,
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    updatedById: string
  ) {
    const item = await estimateRepository.updateItemStatus(itemId, status, updatedById)

    await createAuditLog({
      entityType: "EstimateItem",
      entityId: itemId,
      action: "STATUS_CHANGE",
      changedById: updatedById,
      newValues: { status },
    })

    return item
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    await estimateRepository.softDelete(id, deletedById, deletionReason)

    await createAuditLog({
      entityType: "Estimate",
      entityId: id,
      action: "DELETE",
      changedById: deletedById,
      reason: deletionReason,
    })
  },
}
