/**
 * Payment options printed on a quote-only estimate — offers the patient can
 * choose from, e.g. "Full advance: 5% off", "Full advance: ₹10,000 off",
 * "Instalments 50/25/25", "Pay as you go".
 *
 * Offers only (clinic's choice): nothing here is applied to a bill
 * automatically — any discount is entered by hand on the treatment invoice.
 * Amounts are shown as ranges because the quote itself can be a range.
 */

export type DiscountType = "NONE" | "PERCENT" | "FLAT"

export interface PaymentOption {
  title: string
  discountType: DiscountType
  discountValue: number // % for PERCENT, ₹ for FLAT, ignored for NONE
  splits: number[] // instalment percentages summing to 100; [] = pay as you go
  note: string
}

export interface OptionAmounts {
  min: number
  max: number
  instalments: { pct: number; min: number; max: number }[]
}

function applyDiscount(amount: number, o: PaymentOption): number {
  if (o.discountType === "PERCENT") return Math.max(0, amount - (amount * Math.min(100, Math.max(0, o.discountValue))) / 100)
  if (o.discountType === "FLAT") return Math.max(0, amount - Math.max(0, o.discountValue))
  return amount
}

const round = (n: number) => Math.round(n)

/** What the option costs at the low and high end of the quote, and per instalment. */
export function optionAmounts(o: PaymentOption, quoteMin: number, quoteMax: number): OptionAmounts {
  const min = round(applyDiscount(quoteMin, o))
  const max = round(applyDiscount(Math.max(quoteMin, quoteMax), o))
  const instalments = o.splits.map((pct) => ({ pct, min: round((min * pct) / 100), max: round((max * pct) / 100) }))
  return { min, max, instalments }
}

export function discountLabel(o: PaymentOption): string {
  if (o.discountType === "PERCENT" && o.discountValue > 0) return `${o.discountValue}% off`
  if (o.discountType === "FLAT" && o.discountValue > 0) return `₹${o.discountValue.toLocaleString("en-IN")} off`
  return ""
}

/** "₹6,000" or "₹6,000 – ₹12,000". */
export function formatRange(min: number, max: number): string {
  const f = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`
  return Math.round(max) > Math.round(min) ? `${f(min)} – ${f(max)}` : f(min)
}

/** Starting point for a new quote — the doctor edits/removes freely. */
export function defaultPaymentOptions(): PaymentOption[] {
  return [
    { title: "Pay as you go", discountType: "NONE", discountValue: 0, splits: [], note: "Pay for each treatment on the day it is done." },
    { title: "Full payment in advance", discountType: "PERCENT", discountValue: 5, splits: [100], note: "" },
  ]
}

/** Normalises loosely-typed stored JSON into valid options (drops junk rows). */
export function parsePaymentOptions(raw: unknown): PaymentOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => ({
      title: String(o.title ?? "").slice(0, 80),
      discountType: (["NONE", "PERCENT", "FLAT"].includes(String(o.discountType)) ? o.discountType : "NONE") as DiscountType,
      discountValue: Math.max(0, Number(o.discountValue) || 0),
      splits: Array.isArray(o.splits) ? o.splits.map(Number).filter((n) => n > 0 && n <= 100) : [],
      note: String(o.note ?? "").slice(0, 200),
    }))
    .filter((o) => o.title.trim())
}

// demo(): runnable self-check.
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  const pct: PaymentOption = { title: "Full advance", discountType: "PERCENT", discountValue: 5, splits: [100], note: "" }
  const a = optionAmounts(pct, 6000, 12000)
  ok(a.min === 5700 && a.max === 11400, "5% off a 6k–12k range")
  const flat: PaymentOption = { ...pct, discountType: "FLAT", discountValue: 10000 }
  const b = optionAmounts(flat, 6000, 12000)
  ok(b.min === 0 && b.max === 2000, "₹10k off never goes negative")
  const inst: PaymentOption = { title: "50/25/25", discountType: "NONE", discountValue: 0, splits: [50, 25, 25], note: "" }
  const c = optionAmounts(inst, 6000, 12000)
  ok(c.instalments[0].min === 3000 && c.instalments[0].max === 6000 && c.instalments[2].max === 3000, "instalment ranges")
  ok(formatRange(6000, 12000) === "₹6,000 – ₹12,000" && formatRange(5000, 5000) === "₹5,000", "range format")
  ok(parsePaymentOptions([{ title: "" }, { title: "X", discountType: "BAD", splits: [50, "x", 50] }])[0].discountType === "NONE", "parse cleans junk")
  ok(discountLabel(pct) === "5% off" && discountLabel(flat) === "₹10,000 off", "labels")
  console.log("payment-options OK")
}
