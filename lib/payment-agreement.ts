export interface PaymentStage {
  name: string
  amount: number   // absolute rupee value, may be edited by user
  dueDate: string  // ISO date string "YYYY-MM-DD" or ""
  received: boolean
}

interface Tier {
  label: string
  pct: number
}

function buildStages(total: number, tiers: Tier[]): PaymentStage[] {
  let remaining = total
  return tiers.map((t, i) => {
    const isLast = i === tiers.length - 1
    const amount = isLast ? Math.round(remaining) : Math.round(total * t.pct)
    if (!isLast) remaining -= amount
    return { name: t.label, amount, dueDate: "", received: false }
  })
}

/**
 * Returns a suggested payment schedule based on the estimate total.
 * Tiers follow the clinic's documented policy:
 *   ≤ 25 000          → 100% advance (1 stage)
 *   25 001 – 50 000   → 50 / 50
 *   50 001 – 1 00 000 → 50 / 25 / 25
 *   1 00 001 – 5 00 000 → 35 / 25 / 20 / 20
 *   > 5 00 000        → 25 / 25 / 25 / 25
 */
export function suggestPaymentSchedule(total: number): PaymentStage[] {
  if (total <= 25_000) {
    return buildStages(total, [
      { label: "Advance Payment (Before Treatment)", pct: 1 },
    ])
  }
  if (total <= 50_000) {
    return buildStages(total, [
      { label: "Advance Payment (Before Treatment)", pct: 0.5 },
      { label: "Final Payment (Before Delivery / Completion)", pct: 0.5 },
    ])
  }
  if (total <= 1_00_000) {
    return buildStages(total, [
      { label: "Advance Payment (Before Treatment)", pct: 0.5 },
      { label: "2nd Installment (After Major Clinical Procedure)", pct: 0.25 },
      { label: "Final Payment (Before Prosthesis Delivery)", pct: 0.25 },
    ])
  }
  if (total <= 5_00_000) {
    return buildStages(total, [
      { label: "Advance Payment (Before Treatment)", pct: 0.35 },
      { label: "2nd Installment (After 1st Treatment Phase)", pct: 0.25 },
      { label: "3rd Installment (Before Laboratory Work)", pct: 0.20 },
      { label: "Final Payment (Before Prosthesis Delivery)", pct: 0.20 },
    ])
  }
  // > 5 lakh
  return buildStages(total, [
    { label: "Advance Payment (Before Treatment)", pct: 0.25 },
    { label: "2nd Installment (After 1st Treatment Phase)", pct: 0.25 },
    { label: "3rd Installment (Before Laboratory Fabrication)", pct: 0.25 },
    { label: "Final Payment (Before Prosthesis Delivery)", pct: 0.25 },
  ])
}

export function totalReceived(stages: PaymentStage[]): number {
  return stages.filter((s) => s.received).reduce((sum, s) => sum + s.amount, 0)
}

export function totalScheduled(stages: PaymentStage[]): number {
  return stages.reduce((sum, s) => sum + s.amount, 0)
}

/** Tier label shown in the UI for contextual reference. */
export function getTierLabel(total: number): string {
  if (total <= 25_000) return "≤ ₹25,000 — 100% advance"
  if (total <= 50_000) return "₹25,001–₹50,000 — 50% + 50%"
  if (total <= 1_00_000) return "₹50,001–₹1,00,000 — 50% + 25% + 25%"
  if (total <= 5_00_000) return "₹1,00,001–₹5,00,000 — 35% + 25% + 20% + 20%"
  return "> ₹5,00,000 — 25% × 4"
}

export const PAYMENT_TERMS: string[] = [
  "The treatment estimate is based on the current treatment plan and may change if additional procedures become necessary.",
  "Laboratory work will commence only after receipt of the agreed advance payment.",
  "Payments are due as per the agreed schedule and are not dependent on treatment completion.",
  "Delayed payments may result in postponement of appointments or suspension of laboratory work until outstanding dues are cleared.",
  "Any additional procedures, medications, laboratory work, or treatment modifications not included in the original estimate will be charged separately after discussion with the patient.",
  "All outstanding dues must be paid in full before delivery, cementation, or insertion of the final prosthesis/restoration.",
  "Payments already utilised for completed clinical procedures, laboratory work, or materials are generally non-refundable.",
  "Accepted payment modes include Cash (within applicable legal limits), UPI, Credit/Debit Card, Bank Transfer, and Cheque (subject to clearance).",
]
