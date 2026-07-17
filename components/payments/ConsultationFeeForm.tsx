"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { collectConsultationFeeAction, PaymentFormState } from "@/actions/payments"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PaymentModeSelect } from "@/components/payments/PaymentModeSelect"
import { AlertCircle, CheckCircle2, Loader2, Printer, Receipt } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface Props {
  visitId?: string
  visitNo?: string
  patientId: string
  branchId: string
  defaultFee: number
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

export function ConsultationFeeForm({ visitId, visitNo, patientId, branchId, defaultFee }: Props) {
  const isPreQueue = !visitId
  const [state, formAction] = useActionState(collectConsultationFeeAction, {} as PaymentFormState)

  if (state.success && state.receiptId) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="h-12 w-12" style={{ color: BRAND_COLORS.secondaryGreen }} />
        <div>
          <p className="font-bold text-lg" style={{ color: BRAND_COLORS.bodyText }}>
            Payment Recorded
          </p>
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
            href={`/patients/${patientId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-[#E0E3E5]"
            style={{ color: BRAND_COLORS.bodyText }}
          >
            Go to Patient →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      {visitId && <input type="hidden" name="visitId" value={visitId} />}
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="branchId" value={branchId} />

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Context label */}
      <div
        className="rounded-lg p-3 text-sm"
        style={{ backgroundColor: BRAND_COLORS.lightBackground }}
      >
        {visitId ? (
          <>
            <span style={{ color: BRAND_COLORS.borderDivider }}>Visit: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{visitNo}</strong>
          </>
        ) : (
          <span style={{ color: BRAND_COLORS.borderDivider }}>
            Pre-queue — fee collected before adding patient to the doctor queue.
          </span>
        )}
        <span className="ml-3 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}>
          Consultation
        </span>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Fee Amount <span className="text-red-500">*</span>
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
            min={0}
            step={0.01}
            defaultValue={defaultFee}
            required
            className="pl-7 h-11 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-lg font-semibold bg-[#F2F4F6]"
            style={{ color: BRAND_COLORS.primaryTeal }}
          />
        </div>
        <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          Default fee: {formatCurrency(defaultFee)} — edit if needed. Enter ₹0 for a free consultation.
        </p>
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
