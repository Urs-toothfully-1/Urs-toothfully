import { Decimal } from "@prisma/client/runtime/library"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { createAuditLog } from "@/lib/audit"
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
  plannedSittings: z.number().int().min(1).max(99).default(1),
  sortOrder: z.number().int().default(0),
})

export const createEstimateSchema = z.object({
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  visitId: z.string().uuid(),
  discountPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
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
      plannedSittings: item.plannedSittings ?? 1,
    }))

    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
    let total = subtotal

    let discountAmount: number | undefined
    if (input.discountPercent) {
      discountAmount = (subtotal * input.discountPercent) / 100
      total = subtotal - discountAmount
    }

    const advancePercent = await settingsRepository.get("advance_percent", input.branchId)
    const advanceRequired = total * (parseFloat(advancePercent ?? "20") / 100)

    const estimate = await estimateRepository.create({
      estimateNo,
      patientId: input.patientId,
      branchId: input.branchId,
      doctorId,
      visitId: input.visitId,
      subtotal: new Decimal(subtotal),
      total: new Decimal(total),
      advanceRequired: new Decimal(advanceRequired),
      discountPercent: input.discountPercent ? new Decimal(input.discountPercent) : undefined,
      discountAmount: discountAmount ? new Decimal(discountAmount) : undefined,
      notes: input.notes,
      items,
    })

    await createAuditLog({
      entityType: "Estimate",
      entityId: estimate.id,
      action: "CREATE",
      changedById: doctorId,
      newValues: { estimateNo, total, itemCount: items.length },
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
