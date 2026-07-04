"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { collectTreatmentPaymentAction, PaymentFormState } from "@/actions/payments"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PaymentModeSelect } from "@/components/payments/PaymentModeSelect"
import { AlertCircle, CheckCircle2, Loader2, Printer, Receipt } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface Estimate {
  id: string
  estimateNo: string
  total: number
  paid: number
  balance: number
}

interface Props {
  patientId: string
  branchId: string
  estimates: Estimate[]
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 px-6 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
      ) : (
        <><Receipt className="mr-2 h-4 w-4" />Collect & Generate Receipt</>
      )}
    </Button>
  )
}

export function TreatmentPaymentForm({ patientId, branchId, estimates }: Props) {
  const [state, formAction] = useActionState(collectTreatmentPaymentAction, {} as PaymentFormState)
  const [selectedEstimateId, setSelectedEstimateId] = useState(estimates[0]?.id ?? "")

  const selectedEstimate = estimates.find((e) => e.id === selectedEstimateId)

  if (state.success && state.receiptId) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-12 w-12" style={{ color: BRAND_COLORS.secondaryGreen }} />
        <div>
          <p className="font-bold text-lg" style={{ color: BRAND_COLORS.bodyText }}>Payment Recorded</p>
          <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
            Receipt No: <strong style={{ color: BRAND_COLORS.primaryTeal }}>{state.receiptNo}</strong>
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/print/receipt/${state.receiptId}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </Link>
          <Link
            href="/reception"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-[#E0E3E5]"
            style={{ color: BRAND_COLORS.bodyText }}
          >
            Back to Queue
          </Link>
        </div>
      </div>
    )
  }

  if (estimates.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          No active estimates with outstanding balance.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="estimateId" value={selectedEstimateId} />

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Estimate Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Apply to Estimate <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {estimates.map((e) => (
            <label
              key={e.id}
              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
              style={{
                borderColor: selectedEstimateId === e.id ? BRAND_COLORS.primaryTeal : BRAND_COLORS.lightBackground,
                backgroundColor: selectedEstimateId === e.id ? `${BRAND_COLORS.primaryTeal}08` : "white",
              }}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="estimateSelector"
                  value={e.id}
                  checked={selectedEstimateId === e.id}
                  onChange={() => setSelectedEstimateId(e.id)}
                  className="accent-[#0077BE]"
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                    {e.estimateNo}
                  </p>
                  <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                    Total: {formatCurrency(e.total)} · Paid: {formatCurrency(e.paid)}
                  </p>
                </div>
              </div>
              <span
                className="text-sm font-bold px-3 py-1 rounded"
                style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}
              >
                Balance {formatCurrency(e.balance)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Payment Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Payment Type <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-6">
          {[
            { value: "ADVANCE", label: "Advance" },
            { value: "TREATMENT", label: "Treatment" },
          ].map((t) => (
            <label key={t.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="paymentType"
                value={t.value}
                defaultChecked={t.value === "ADVANCE"}
                required
                className="accent-[#0077BE]"
              />
              <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Amount <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold"
            style={{ color: BRAND_COLORS.borderDivider }}
          >
            ₹
          </span>
          <Input
            name="amount"
            type="number"
            min={1}
            max={selectedEstimate?.balance}
            step={0.01}
            required
            placeholder="Enter amount"
            className="pl-7 h-11 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-lg font-semibold bg-[#F2F4F6]"
            style={{ color: BRAND_COLORS.primaryTeal }}
          />
        </div>
        {selectedEstimate && (
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            Outstanding balance: <strong style={{ color: "#C2410C" }}>{formatCurrency(selectedEstimate.balance)}</strong>
          </p>
        )}
      </div>

      <PaymentModeSelect required />

      {/* Transaction Ref */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Transaction / UPI Reference
        </Label>
        <Input
          name="transactionRef"
          placeholder="Ref number (for UPI / Card)"
          className="h-10 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6]"
        />
      </div>

      <SubmitBtn />
    </form>
  )
}
