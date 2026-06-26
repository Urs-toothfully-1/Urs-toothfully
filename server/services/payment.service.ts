import { PaymentMode, PaymentType } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"

export const createPaymentSchema = z.discriminatedUnion("paymentType", [
  z.object({
    paymentType: z.literal("CONSULTATION"),
    visitId: z.string().uuid(),
    estimateId: z.undefined().optional(),
    patientId: z.string().uuid(),
    branchId: z.string().uuid(),
    amount: z.number().positive(),
    mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
    transactionRef: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    paymentType: z.enum(["TREATMENT", "ADVANCE"]),
    estimateId: z.string().uuid(),
    visitId: z.string().uuid().optional(),
    patientId: z.string().uuid(),
    branchId: z.string().uuid(),
    amount: z.number().positive(),
    mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
    transactionRef: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    paymentType: z.literal("ADJUSTMENT"),
    estimateId: z.string().uuid().optional(),
    visitId: z.string().uuid().optional(),
    patientId: z.string().uuid(),
    branchId: z.string().uuid(),
    amount: z.number().positive(),
    mode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]),
    transactionRef: z.string().max(100).optional(),
    notes: z.string().min(1, "Reason required for adjustments"),
  }),
])

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

async function generateNextReceiptNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await paymentRepository.getLatestReceiptNoForYear(year)
  const next = latest ? parseInt(latest.split("-")[2]) + 1 : 1
  return `RCP-${year}-${String(next).padStart(5, "0")}`
}

export const paymentService = {
  async getByPatient(patientId: string) {
    return paymentRepository.findByPatient(patientId)
  },

  async getOutstandingByEstimate(estimateId: string, estimateTotal: number) {
    const payments = await paymentRepository.findByEstimate(estimateId)
    const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    return Math.max(0, estimateTotal - paid)
  },

  async create(input: CreatePaymentInput, collectedById: string) {
    const receiptNo = await generateNextReceiptNo()

    const { payment, receipt } = await paymentRepository.createWithReceiptAndAccounting({
      paymentType: input.paymentType as PaymentType,
      estimateId: "estimateId" in input ? input.estimateId : undefined,
      visitId: input.visitId,
      patientId: input.patientId,
      branchId: input.branchId,
      amount: new Decimal(input.amount),
      mode: input.mode as PaymentMode,
      transactionRef: input.transactionRef,
      notes: input.notes,
      collectedById,
      receiptNo,
      issuedById: collectedById,
    })

    await createAuditLog({
      entityType: "Payment",
      entityId: payment.id,
      action: "CREATE",
      changedById: collectedById,
      newValues: {
        paymentType: input.paymentType,
        amount: input.amount,
        mode: input.mode,
        receiptNo,
      },
      branchId: input.branchId,
    })

    return { payment, receipt }
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    const payment = await paymentRepository.findById(id)
    if (!payment) throw new Error("Payment not found")

    await paymentRepository.softDelete(id, deletedById, deletionReason)

    await createAuditLog({
      entityType: "Payment",
      entityId: id,
      action: "DELETE",
      changedById: deletedById,
      previousValues: { amount: Number(payment.amount), paymentType: payment.paymentType },
      reason: deletionReason,
    })
  },

  async getConsultationFee(branchId: string): Promise<number> {
    const fee = await settingsRepository.get("consultation_fee", branchId)
    return fee ? parseFloat(fee) : 500
  },
}
