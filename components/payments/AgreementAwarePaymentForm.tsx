"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { collectStagePaymentAction, PaymentFormState } from "@/actions/payments"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PaymentModeSelect } from "@/components/payments/PaymentModeSelect"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Printer,
  Receipt,
  CalendarClock,
  Zap,
} from "lucide-react"
import Link from "next/link"

interface Stage {
  name: string
  amount: number
  dueDate: string
  received: boolean
}

interface EstimateOption {
  id: string
  estimateNo: string
  total: number
  paid: number
  balance: number
  stages: Stage[]
}

interface Props {
  patientId: string
  branchId: string
  estimates: EstimateOption[]
}

function SubmitBtn({ label }: { label: string }) {
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
        <><Receipt className="mr-2 h-4 w-4" />{label}</>
      )}
    </Button>
  )
}

export function AgreementAwarePaymentForm({ patientId, branchId, estimates }: Props) {
  const [state, formAction] = useActionState(collectStagePaymentAction, {} as PaymentFormState)
  const [selectedEstimateId, setSelectedEstimateId] = useState(estimates[0]?.id ?? "")
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null)
  const [amount, setAmount] = useState("")

  const selectedEstimate = estimates.find((e) => e.id === selectedEstimateId)
  const stages = selectedEstimate?.stages ?? []

  function handleSelectEstimate(id: string) {
    setSelectedEstimateId(id)
    setSelectedStageIndex(null)
    setAmount("")
  }

  function handleStageClick(index: number, stageAmount: number) {
    setSelectedStageIndex(index)
    setAmount(stageAmount.toFixed(2))
  }

  function handleAmountChange(val: string) {
    setAmount(val)
    setSelectedStageIndex(null)
  }

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
            <Printer className="h-4 w-4" />Print Receipt
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

  const pendingStages = stages.filter((s) => !s.received)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="estimateId" value={selectedEstimateId} />
      <input type="hidden" name="paymentType" value="TREATMENT" />
      {selectedStageIndex !== null && (
        <input type="hidden" name="stageIndex" value={selectedStageIndex} />
      )}

      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Estimate selector */}
      {estimates.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Estimate
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
                    onChange={() => handleSelectEstimate(e.id)}
                    className="accent-[#0077BE]"
                  />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{e.estimateNo}</p>
                    <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                      Total: {formatCurrency(e.total)} · Paid: {formatCurrency(e.paid)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold px-3 py-1 rounded" style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}>
                  Balance {formatCurrency(e.balance)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      {estimates.length === 1 && (
        <div
          className="flex items-center justify-between p-3 rounded-lg border"
          style={{ borderColor: BRAND_COLORS.primaryTeal, backgroundColor: `${BRAND_COLORS.primaryTeal}08` }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{selectedEstimate?.estimateNo}</p>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Total: {formatCurrency(selectedEstimate?.total ?? 0)} · Paid: {formatCurrency(selectedEstimate?.paid ?? 0)}
            </p>
          </div>
          <span className="text-sm font-bold px-3 py-1 rounded" style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}>
            Balance {formatCurrency(selectedEstimate?.balance ?? 0)}
          </span>
        </div>
      )}

      {/* Payment Agreement Stages */}
      {stages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Payment Schedule
            </Label>
            {pendingStages.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}>
                {pendingStages.length} pending
              </span>
            )}
          </div>
          <div className="rounded-xl border border-[#E0E3E5] divide-y divide-[#F2F4F6] overflow-hidden">
            {stages.map((stage, i) => {
              const isSelected = selectedStageIndex === i
              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 transition-colors"
                  style={{
                    backgroundColor: stage.received
                      ? "#F0FDF4"
                      : isSelected
                      ? `${BRAND_COLORS.primaryTeal}08`
                      : "white",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      {stage.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-sm font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                        {formatCurrency(stage.amount)}
                      </span>
                      {stage.dueDate && (
                        <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                          Due: {new Date(stage.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {stage.received ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />Received
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStageClick(i, stage.amount)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{
                          backgroundColor: isSelected ? BRAND_COLORS.primaryTeal : `${BRAND_COLORS.primaryTeal}15`,
                          color: isSelected ? "white" : BRAND_COLORS.primaryTeal,
                          border: `1px solid ${isSelected ? BRAND_COLORS.primaryTeal : `${BRAND_COLORS.primaryTeal}40`}`,
                        }}
                      >
                        <Zap className="h-3 w-3" />
                        {isSelected ? "Selected" : `Collect ${formatCurrency(stage.amount)}`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {selectedStageIndex !== null && (
            <p className="text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
              Collecting <strong>{stages[selectedStageIndex]?.name}</strong> — amount pre-filled. Change the amount below for partial or custom payment.
            </p>
          )}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Amount <span className="text-red-500">*</span>
          </Label>
          {selectedStageIndex !== null && (
            <button
              type="button"
              onClick={() => { setSelectedStageIndex(null); setAmount("") }}
              className="text-xs hover:underline"
              style={{ color: BRAND_COLORS.borderDivider }}
            >
              Clear stage selection
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>₹</span>
          <Input
            name="amount"
            type="number"
            min={1}
            step={0.01}
            required
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="Enter amount"
            className="pl-7 h-11 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-lg font-semibold bg-[#F2F4F6]"
            style={{ color: BRAND_COLORS.primaryTeal }}
          />
        </div>
        {selectedEstimate && (
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            Outstanding balance:{" "}
            <strong style={{ color: "#C2410C" }}>{formatCurrency(selectedEstimate.balance)}</strong>
            {selectedStageIndex === null && " · Custom amount"}
          </p>
        )}
      </div>

      <PaymentModeSelect required />

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

      <div className="space-y-1.5">
        <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          Notes
        </Label>
        <Input
          name="notes"
          placeholder="Optional note"
          className="h-10 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6]"
        />
      </div>

      <SubmitBtn label={selectedStageIndex !== null ? `Collect Stage Payment & Generate Receipt` : "Collect Payment & Generate Receipt"} />
    </form>
  )
}
