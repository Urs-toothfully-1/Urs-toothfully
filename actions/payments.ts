"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { paymentService } from "@/server/services/payment.service"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { validatePaymentInput } from "@/lib/payment-guard"
import type { PaymentMode } from "@prisma/client"

export type PaymentFormState = {
  success?: boolean
  error?: string
  receiptNo?: string
  receiptId?: string
}

export async function collectConsultationFeeAction(
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const visitId = formData.get("visitId")?.toString()
  const patientId = formData.get("patientId")?.toString()
  const branchId = formData.get("branchId")?.toString() ?? session.branchId
  const amountStr = formData.get("amount")?.toString()
  const mode = formData.get("mode")?.toString()
  const transactionRef = formData.get("transactionRef")?.toString() || undefined
  const notes = formData.get("notes")?.toString() || undefined

  if (!patientId || !amountStr || !mode) {
    return { error: "Missing required fields." }
  }

  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) return { error: "Invalid amount." }

  try {
    validatePaymentInput({ paymentType: "CONSULTATION", visitId, amount }, session.role)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Validation failed." }
  }

  try {
    const { receipt } = await paymentService.create(
      {
        paymentType: "CONSULTATION",
        visitId,
        patientId,
        branchId,
        amount,
        mode: mode as PaymentMode,
        transactionRef,
        notes,
      },
      session.userId
    )

    revalidatePath(`/patients/${patientId}/payments`)
    revalidatePath("/reception")
    return { success: true, receiptNo: receipt.receiptNo, receiptId: receipt.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record payment." }
  }
}

export async function collectTreatmentPaymentAction(
  _prev: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const estimateId = formData.get("estimateId")?.toString()
  const patientId = formData.get("patientId")?.toString()
  const branchId = formData.get("branchId")?.toString() ?? session.branchId
  const paymentType = formData.get("paymentType")?.toString() as "TREATMENT" | "ADVANCE"
  const amountStr = formData.get("amount")?.toString()
  const mode = formData.get("mode")?.toString()
  const transactionRef = formData.get("transactionRef")?.toString() || undefined
  const notes = formData.get("notes")?.toString() || undefined

  if (!estimateId || !patientId || !amountStr || !mode || !paymentType) {
    return { error: "Missing required fields." }
  }

  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) return { error: "Invalid amount." }

  // Validate amount does not exceed outstanding balance
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) return { error: "Estimate not found." }

  const outstanding = await paymentService.getOutstandingByEstimate(
    estimateId,
    Number(estimate.total)
  )

  if (amount > outstanding + 0.01) {
    return { error: `Amount (₹${amount}) exceeds outstanding balance (₹${outstanding.toFixed(2)}).` }
  }

  try {
    validatePaymentInput({ paymentType, estimateId, amount }, session.role)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Validation failed." }
  }

  try {
    const { receipt } = await paymentService.create(
      {
        paymentType,
        estimateId,
        patientId,
        branchId,
        amount,
        mode: mode as PaymentMode,
        transactionRef,
        notes,
      },
      session.userId
    )

    revalidatePath(`/patients/${patientId}/payments`)
    revalidatePath(`/patients/${patientId}/estimates`)
    revalidatePath("/reception")
    return { success: true, receiptNo: receipt.receiptNo, receiptId: receipt.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record payment." }
  }
}
