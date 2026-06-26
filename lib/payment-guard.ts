import type { Role } from "@/lib/session"

export interface PaymentInput {
  paymentType: "CONSULTATION" | "TREATMENT" | "ADVANCE" | "ADJUSTMENT"
  visitId?: string
  estimateId?: string
  amount: number
  notes?: string
}

export function validatePaymentInput(input: PaymentInput, role: Role): void {
  if (input.amount <= 0) throw new Error("Amount must be greater than zero")

  if (input.paymentType === "CONSULTATION") {
    if (!input.visitId) throw new Error("visitId is required for CONSULTATION payment")
    if (input.estimateId) throw new Error("estimateId must not be set for CONSULTATION payment")
  }

  if (input.paymentType === "TREATMENT" || input.paymentType === "ADVANCE") {
    if (!input.estimateId) throw new Error("estimateId is required for TREATMENT / ADVANCE payment")
  }

  if (input.paymentType === "ADJUSTMENT") {
    if (role !== "ADMIN") throw new Error("Only ADMIN can record ADJUSTMENT payments")
    if (!input.notes?.trim()) throw new Error("Reason is required for ADJUSTMENT payments")
  }
}
