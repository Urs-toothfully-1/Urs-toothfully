import type { Role } from "@/lib/session"

export interface PaymentInput {
  paymentType: "CONSULTATION" | "TREATMENT" | "ADVANCE" | "ADJUSTMENT"
  visitId?: string
  estimateId?: string
  amount: number
  notes?: string
}

// Highest single payment we ever expect — guards against overflow / fat-finger
// entries. Full-mouth rehab tops out well under this.
const MAX_PAYMENT = 10_000_000

export function validatePaymentInput(input: PaymentInput, role: Role): void {
  // Reject NaN, Infinity, strings — "NaN <= 0" is false, so it would slip past
  // a naive check and corrupt the ledger.
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount)) {
    throw new Error("Amount must be a valid number")
  }
  if (input.amount <= 0) throw new Error("Amount must be greater than zero")
  if (input.amount > MAX_PAYMENT) throw new Error("Amount exceeds the maximum allowed")

  if (input.paymentType === "CONSULTATION") {
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
