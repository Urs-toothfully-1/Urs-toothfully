/**
 * What an estimate makes the patient owe — the single rule every balance,
 * report and payment guard uses.
 *
 * - Legacy estimates (invoiceBilling = false): the quoted `total` is owed.
 * - Quote-only estimates (invoiceBilling = true, every estimate created after the
 *   invoice workflow shipped): only what has been invoiced at treatment visits
 *   (`invoicedTotal`) is owed. The quote itself is never pending.
 */
export interface OwedSource {
  invoiceBilling: boolean
  total: unknown // Prisma Decimal | number
  invoicedTotal?: unknown
}

export function owedAmount(e: OwedSource): number {
  return Number((e.invoiceBilling ? e.invoicedTotal : e.total) ?? 0)
}

/** Fields to select on an Estimate so owedAmount() has what it needs. */
export const OWED_SELECT = { invoiceBilling: true, total: true, invoicedTotal: true } as const

// demo(): runnable self-check.
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  ok(owedAmount({ invoiceBilling: false, total: 15000, invoicedTotal: 0 }) === 15000, "legacy owes the quote")
  ok(owedAmount({ invoiceBilling: true, total: 15000, invoicedTotal: 0 }) === 0, "quote-only owes nothing until invoiced")
  ok(owedAmount({ invoiceBilling: true, total: 15000, invoicedTotal: 7000 }) === 7000, "quote-only owes the invoiced amount")
  console.log("estimate-owed OK")
}
