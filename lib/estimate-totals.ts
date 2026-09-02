// Single source of truth for estimate discount math — imported by both the
// server (estimate.service) and the client (EstimateBuilder live preview) so the
// numbers can never disagree.
//
// Model: each line has a gross (qty × rate) and its own discount (% or ₹). The
// GLOBAL discount (% or ₹) then applies on top of the after-line subtotal.

export interface DiscountLine {
  quantity: number
  unitRate: number
  discountValue: number
  discountIsPercent: boolean
  /** Alternatives are quoted for comparison, never charged. */
  isAlternative?: boolean
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Gross for a line, before any discount. */
export function lineGross(i: { quantity: number; unitRate: number }): number {
  return round2((Number(i.quantity) || 0) * (Number(i.unitRate) || 0))
}

/** The ₹ discount for one line — clamped to [0, gross]. */
export function lineDiscountAmount(i: DiscountLine): number {
  const gross = lineGross(i)
  const v = Number(i.discountValue) || 0
  if (v <= 0) return 0
  const d = i.discountIsPercent ? (gross * v) / 100 : v
  return round2(Math.min(Math.max(0, d), gross))
}

export interface EstimateTotals {
  subtotal: number // Σ line gross (charged lines only)
  lineDiscountTotal: number // Σ per-line discounts
  afterLine: number // subtotal − line discounts
  globalDiscount: number // ₹ taken by the global discount
  total: number // final payable
  discountAmount: number // effective overall ₹ off (subtotal − total)
  discountPercent: number // effective overall % off
}

export function computeEstimateTotals(
  items: DiscountLine[],
  globalDiscountValue: number,
  globalDiscountIsPercent: boolean
): EstimateTotals {
  const charged = items.filter((i) => !i.isAlternative)
  const subtotal = round2(charged.reduce((s, i) => s + lineGross(i), 0))
  const lineDiscountTotal = round2(charged.reduce((s, i) => s + lineDiscountAmount(i), 0))
  const afterLine = round2(subtotal - lineDiscountTotal)

  let globalDiscount = 0
  const g = Number(globalDiscountValue) || 0
  if (g > 0) {
    const raw = globalDiscountIsPercent ? (afterLine * g) / 100 : g
    globalDiscount = round2(Math.min(Math.max(0, raw), afterLine))
  }

  const total = round2(afterLine - globalDiscount)
  const discountAmount = round2(subtotal - total)
  const discountPercent = subtotal > 0 ? round2((discountAmount / subtotal) * 100) : 0
  return { subtotal, lineDiscountTotal, afterLine, globalDiscount, total, discountAmount, discountPercent }
}

// ── self-check (run: npx tsx lib/estimate-totals.ts) ─────────────────────────
// `typeof module` guard first — `module` is undefined in the browser bundle, and
// referencing it directly (require.main === module) throws there.
if (typeof module !== "undefined" && typeof require !== "undefined" && require.main === module) {
  const assert = (cond: boolean, msg: string) => { if (!cond) { throw new Error("FAIL: " + msg) } }
  // Line A ₹10,000 −10%; Line B ₹5,000 −₹500; global −5%.
  const t = computeEstimateTotals(
    [
      { quantity: 1, unitRate: 10000, discountValue: 10, discountIsPercent: true },
      { quantity: 1, unitRate: 5000, discountValue: 500, discountIsPercent: false },
    ],
    5, true
  )
  assert(t.subtotal === 15000, `subtotal ${t.subtotal}`)
  assert(t.lineDiscountTotal === 1500, `lineDisc ${t.lineDiscountTotal}`) // 1000 + 500
  assert(t.afterLine === 13500, `afterLine ${t.afterLine}`)
  assert(t.globalDiscount === 675, `global ${t.globalDiscount}`) // 5% of 13500
  assert(t.total === 12825, `total ${t.total}`)
  assert(t.discountAmount === 2175, `discAmt ${t.discountAmount}`)
  // Flat ₹ global bigger than subtotal is clamped, alternatives excluded.
  const t2 = computeEstimateTotals(
    [
      { quantity: 2, unitRate: 1000, discountValue: 0, discountIsPercent: true },
      { quantity: 1, unitRate: 9999, discountValue: 0, discountIsPercent: true, isAlternative: true },
    ],
    99999, false
  )
  assert(t2.subtotal === 2000 && t2.total === 0, `clamp/alt: sub ${t2.subtotal} total ${t2.total}`)
  console.log("estimate-totals self-check passed")
}
