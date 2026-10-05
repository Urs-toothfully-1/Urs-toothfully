"use client"

import { forwardRef, useImperativeHandle, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileSignature, Plus, Trash2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { savePaymentAgreementAction } from "@/actions/payment-agreement"
import { discountLabel, formatRange, optionAmounts, type DiscountType, type PaymentOption } from "@/lib/payment-options"
import type { PaymentAgreementCardHandle } from "@/components/estimates/PaymentAgreementCard"

const inputCls =
  "h-8 rounded border border-[#E0E3E5] bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#005E97]"

/**
 * Payment plan for a quote-only estimate: a list of offers printed for the
 * patient ("Full advance — 5% off", "50/50 instalments", "Pay as you go").
 * Nothing is charged from here; the doctor bills each treatment on an invoice.
 */
export const PaymentOptionsCard = forwardRef<PaymentAgreementCardHandle, {
  estimateId: string
  quoteMin: number
  quoteMax: number
  initialOptions: PaymentOption[]
  initialRep: string | null
  initialTermsAccepted: boolean
  initialPatientSignedAt: string | null
}>(function PaymentOptionsCard({ estimateId, quoteMin, quoteMax, initialOptions, initialRep, initialTermsAccepted, initialPatientSignedAt }, ref) {
  const router = useRouter()
  const [options, setOptions] = useState<PaymentOption[]>(initialOptions)
  // Instalment splits edited as text ("50/25/25") — parsed on save.
  const [splitText, setSplitText] = useState<string[]>(initialOptions.map((o) => o.splits.join("/")))
  const [error, setError] = useState<string | null>(null)

  function update(idx: number, patch: Partial<PaymentOption>) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)))
  }
  function parseSplits(t: string): number[] {
    return t.split(/[^\d.]+/).map(Number).filter((n) => n > 0)
  }

  async function save(): Promise<boolean> {
    const final = options.map((o, i) => ({ ...o, title: o.title.trim(), splits: parseSplits(splitText[i] ?? "") }))
    if (final.some((o) => !o.title)) { setError("Every option needs a title."); return false }
    const bad = final.find((o) => o.splits.length > 0 && Math.round(o.splits.reduce((s, n) => s + n, 0)) !== 100)
    if (bad) { setError(`Instalments in "${bad.title}" must add up to 100%.`); return false }
    setError(null)
    const fd = new FormData()
    fd.set("payload", JSON.stringify({
      estimateId,
      stages: [],
      options: final,
      clinicRepresentative: initialRep,
      termsAccepted: initialTermsAccepted,
      patientSignedAt: initialPatientSignedAt,
    }))
    const res = await savePaymentAgreementAction({}, fd).catch(() => ({ error: "Save failed" }) as { success?: boolean; error?: string })
    if (!res.success) { setError(res.error ?? "Save failed"); return false }
    router.refresh()
    return true
  }

  useImperativeHandle(ref, () => ({ save }))

  return (
    <Card className="border-[#E0E3E5] bg-white overflow-hidden">
      <div className="h-1" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }} />
      <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
          <FileSignature className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
          Payment Options
          <span className="text-xs font-normal" style={{ color: BRAND_COLORS.borderDivider }}>
            Quote {formatRange(quoteMin, quoteMax)}
          </span>
        </CardTitle>
        <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
          Offers printed on the estimate for the patient to choose from. Nothing is added to the pending amount —
          the patient owes only what you bill on each treatment invoice. Enter any agreed discount on the invoice.
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {options.map((o, i) => {
          const amt = optionAmounts({ ...o, splits: parseSplits(splitText[i] ?? "") }, quoteMin, quoteMax)
          return (
            <div key={i} className="rounded-md border p-3 space-y-2" style={{ borderColor: "#E0E3E5" }}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={o.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="e.g. Full payment in advance"
                  maxLength={80}
                  className={`${inputCls} flex-1 min-w-[180px] font-medium`}
                  aria-label="Option title"
                />
                <select
                  value={o.discountType}
                  onChange={(e) => update(i, { discountType: e.target.value as DiscountType })}
                  className={inputCls}
                  aria-label="Discount type"
                >
                  <option value="NONE">No discount</option>
                  <option value="PERCENT">% off</option>
                  <option value="FLAT">₹ off</option>
                </select>
                {o.discountType !== "NONE" && (
                  <input
                    type="number"
                    min={0}
                    value={o.discountValue || ""}
                    onChange={(e) => update(i, { discountValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder={o.discountType === "PERCENT" ? "5" : "10000"}
                    className={`${inputCls} w-24 text-right`}
                    aria-label="Discount value"
                  />
                )}
                <button
                  type="button"
                  onClick={() => { setOptions((p) => p.filter((_, j) => j !== i)); setSplitText((p) => p.filter((_, j) => j !== i)) }}
                  className="p-1 rounded hover:bg-red-50"
                  aria-label="Remove option"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={splitText[i] ?? ""}
                  onChange={(e) => setSplitText((p) => p.map((t, j) => (j === i ? e.target.value : t)))}
                  placeholder="Instalments % e.g. 50/50 (empty = pay per visit)"
                  className={`${inputCls} w-64`}
                  aria-label="Instalment percentages"
                />
                <input
                  value={o.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  placeholder="Note (optional)"
                  maxLength={200}
                  className={`${inputCls} flex-1 min-w-[160px]`}
                  aria-label="Option note"
                />
              </div>
              <p className="text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                Patient pays <strong>{formatRange(amt.min, amt.max)}</strong>
                {discountLabel(o) && <span style={{ color: BRAND_COLORS.secondaryGreen }}> ({discountLabel(o)})</span>}
                {amt.instalments.length > 1 && (
                  <span style={{ color: BRAND_COLORS.borderDivider }}>
                    {" "}· {amt.instalments.map((s) => `${s.pct}%: ${formatRange(s.min, s.max)}`).join(" · ")}
                  </span>
                )}
              </p>
            </div>
          )
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={options.length >= 8}
          onClick={() => {
            setOptions((p) => [...p, { title: "", discountType: "NONE", discountValue: 0, splits: [], note: "" }])
            setSplitText((p) => [...p, ""])
          }}
        >
          <Plus className="h-4 w-4" /> Add option
        </Button>

        {error && (
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        )}
      </CardContent>
    </Card>
  )
})
