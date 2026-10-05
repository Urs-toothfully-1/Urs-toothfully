/**
 * Treatment-invoice arithmetic — shared by the billing dialog (live preview) and
 * the server (what gets stored), so the two can never disagree.
 */

export interface InvoiceLine {
  quantity: number
  unitRate: number
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  total: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function computeInvoiceTotals(
  lines: InvoiceLine[],
  discountValue: number,
  discountIsPercent: boolean
): InvoiceTotals {
  const subtotal = r2(lines.reduce((s, l) => s + Math.max(0, l.quantity) * Math.max(0, l.unitRate), 0))
  const raw = discountIsPercent ? (subtotal * Math.min(100, Math.max(0, discountValue))) / 100 : Math.max(0, discountValue)
  const discountAmount = r2(Math.min(subtotal, raw)) // a discount can't make a bill negative
  return { subtotal, discountAmount, total: r2(subtotal - discountAmount) }
}

// demo(): runnable self-check.
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  const a = computeInvoiceTotals([{ quantity: 1, unitRate: 8500 }, { quantity: 2, unitRate: 1000 }], 0, false)
  ok(a.subtotal === 10500 && a.total === 10500, "plain subtotal")
  const b = computeInvoiceTotals([{ quantity: 1, unitRate: 10000 }], 5, true)
  ok(b.discountAmount === 500 && b.total === 9500, "5% off")
  const c = computeInvoiceTotals([{ quantity: 1, unitRate: 3000 }], 5000, false)
  ok(c.discountAmount === 3000 && c.total === 0, "₹ discount capped at the bill")
  ok(computeInvoiceTotals([{ quantity: 1, unitRate: 1000 }], 150, true).total === 0, "% capped at 100")
  console.log("invoice-totals OK")
}
