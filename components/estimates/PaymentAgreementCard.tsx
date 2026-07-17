"use client"

import { forwardRef, useActionState, useImperativeHandle, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  FileSignature,
} from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import {
  PaymentStage,
  suggestPaymentSchedule,
  totalReceived,
  totalScheduled,
  getTierLabel,
  PAYMENT_TERMS,
} from "@/lib/payment-agreement"
import { savePaymentAgreementAction, SavePaymentAgreementState } from "@/actions/payment-agreement"

interface Props {
  estimateId: string
  estimateTotal: number
  initialStages: PaymentStage[]
  initialRep: string | null
  initialTermsAccepted: boolean
  initialPatientSignedAt: string | null
  estimateNo: string
  patientName: string
  doctorName: string
}

export interface PaymentAgreementCardHandle {
  save: () => void
}

const inputCls =
  "w-full h-8 rounded border border-[#E0E3E5] bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#005E97]"

function formatAmt(n: number) {
  return n.toLocaleString("en-IN")
}

export const PaymentAgreementCard = forwardRef<PaymentAgreementCardHandle, Props>(function PaymentAgreementCard({
  estimateId,
  estimateTotal,
  initialStages,
  initialRep,
  initialTermsAccepted,
  initialPatientSignedAt,
  estimateNo,
  patientName,
  doctorName,
}: Props, ref) {
  const [stages, setStages] = useState<PaymentStage[]>(initialStages)
  const [rep, setRep] = useState(initialRep ?? "")
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted)
  const [patientSignedAt, setPatientSignedAt] = useState(
    initialPatientSignedAt ? new Date(initialPatientSignedAt).toISOString().split("T")[0] : ""
  )
  const [, startTransition] = useTransition()
  const [state, formAction] = useActionState<SavePaymentAgreementState, FormData>(
    savePaymentAgreementAction,
    {}
  )

  function resetToSuggested() {
    setStages(suggestPaymentSchedule(estimateTotal))
  }

  // Keep the schedule summing to the estimate total: received stages and the
  // just-edited stage stay put; the last other unreceived stage absorbs the rest.
  function rebalance(list: PaymentStage[], keepIdx: number): PaymentStage[] {
    let absorber = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].received && i !== keepIdx) { absorber = i; break }
    }
    if (absorber === -1) return list
    const sumOthers = list.reduce((s, st, i) => (i === absorber ? s : s + st.amount), 0)
    const amount = Math.max(0, Math.round(estimateTotal - sumOthers))
    return list.map((s, i) => (i === absorber ? { ...s, amount } : s))
  }

  function addRow() {
    setStages((prev) => [...prev, { name: "Additional Installment", amount: 0, dueDate: "", received: false }])
  }

  function removeRow(idx: number) {
    setStages((prev) => rebalance(prev.filter((_, i) => i !== idx), -1))
  }

  function balanceAfterEdit(idx: number) {
    setStages((prev) => rebalance(prev, idx))
  }

  function updateStage<K extends keyof PaymentStage>(idx: number, key: K, val: PaymentStage[K]) {
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: val } : s)))
  }

  function handleSubmit() {
    const fd = new FormData()
    fd.set(
      "payload",
      JSON.stringify({
        estimateId,
        stages,
        clinicRepresentative: rep || null,
        termsAccepted,
        patientSignedAt: patientSignedAt || null,
      })
    )
    startTransition(() => formAction(fd))
  }

  useImperativeHandle(ref, () => ({ save: handleSubmit }))

  const received = totalReceived(stages)
  const scheduled = totalScheduled(stages)
  const balance = Math.max(0, estimateTotal - received)

  return (
    <Card className="border-[#E0E3E5] bg-white overflow-hidden">
      <div className="h-1" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }} />
      <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <FileSignature className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
            Payment Agreement
            <span className="text-xs font-normal px-2 py-0.5 rounded" style={{ backgroundColor: "#EFF9F4", color: BRAND_COLORS.secondaryGreen }}>
              {getTierLabel(estimateTotal)}
            </span>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToSuggested}
            className="h-7 text-xs gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Suggested
          </Button>
        </div>
        <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
          Edit amounts, due dates, and received status freely. Click <strong>Save Agreement</strong> to persist changes.
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Patient & Estimate info row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs p-3 rounded-md" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
          <div><p style={{ color: BRAND_COLORS.borderDivider }}>Patient</p><p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{patientName}</p></div>
          <div><p style={{ color: BRAND_COLORS.borderDivider }}>Estimate</p><p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{estimateNo}</p></div>
          <div><p style={{ color: BRAND_COLORS.borderDivider }}>Doctor</p><p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{doctorName}</p></div>
          <div><p style={{ color: BRAND_COLORS.borderDivider }}>Treatment Cost</p><p className="font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(estimateTotal)}</p></div>
        </div>

        {/* Payment schedule table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr>
                {["Payment Stage", "Amount (₹)", "Due Date", "Received", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold py-1 px-2"
                    style={{ color: BRAND_COLORS.borderDivider }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, idx) => (
                <tr key={idx} className="rounded-md" style={{ backgroundColor: stage.received ? "#EFF9F4" : "white" }}>
                  {/* Stage Name */}
                  <td className="py-1.5 px-2 w-[40%]">
                    <input
                      value={stage.name}
                      onChange={(e) => updateStage(idx, "name", e.target.value)}
                      className={inputCls}
                      placeholder="Stage name"
                    />
                  </td>
                  {/* Amount */}
                  <td className="py-1.5 px-2 w-32">
                    <input
                      type="number"
                      min={0}
                      value={stage.amount === 0 ? "" : stage.amount}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateStage(idx, "amount", raw === "" ? 0 : Math.max(0, Number(raw)))
                      }}
                      onBlur={() => balanceAfterEdit(idx)}
                      disabled={stage.received}
                      placeholder="0"
                      className={`${inputCls} font-mono disabled:opacity-60`}
                      title={stage.received ? "Received — amount locked" : "Other installments auto-adjust so the total stays exact"}
                    />
                  </td>
                  {/* Due Date */}
                  <td className="py-1.5 px-2 w-36">
                    <input
                      type="date"
                      value={stage.dueDate}
                      onChange={(e) => updateStage(idx, "dueDate", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  {/* Received toggle */}
                  <td className="py-1.5 px-2 w-24 text-center">
                    <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stage.received}
                        onChange={(e) => updateStage(idx, "received", e.target.checked)}
                        className="h-4 w-4 accent-[#006B5F]"
                      />
                      <span className="text-xs" style={{ color: stage.received ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.borderDivider }}>
                        {stage.received ? "Yes" : "No"}
                      </span>
                    </label>
                  </td>
                  {/* Remove */}
                  <td className="py-1.5 px-2 w-8">
                    {stages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row + totals */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3 w-3" />
            Add Installment
          </Button>

          <div className="flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Total Scheduled</p>
              <p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                ₹{formatAmt(scheduled)}
                {scheduled !== estimateTotal && (
                  <span className="ml-1 text-xs text-amber-600">(estimate: ₹{formatAmt(estimateTotal)})</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Received</p>
              <p className="font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>₹{formatAmt(received)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Balance Outstanding</p>
              <p className="font-bold" style={{ color: balance > 0 ? "#C2410C" : BRAND_COLORS.secondaryGreen }}>
                ₹{formatAmt(balance)}
              </p>
            </div>
          </div>
        </div>

        {/* Clinic representative + patient sign-off */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: BRAND_COLORS.bodyText }}>
              Clinic Representative Name
            </label>
            <input
              value={rep}
              onChange={(e) => setRep(e.target.value)}
              placeholder="Staff or doctor signing on behalf of clinic"
              className={inputCls + " h-9"}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: BRAND_COLORS.bodyText }}>
              Patient Signed On
            </label>
            <input
              type="date"
              value={patientSignedAt}
              onChange={(e) => setPatientSignedAt(e.target.value)}
              className={inputCls + " h-9"}
            />
          </div>
        </div>

        {/* Terms accepted */}
        <label className="flex items-start gap-2.5 p-3 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#005E97]"
          />
          <span className="text-xs" style={{ color: BRAND_COLORS.secondaryText }}>
            <strong style={{ color: BRAND_COLORS.bodyText }}>Terms & Conditions accepted</strong>
            {" — "}The above payment schedule has been explained to and accepted by the patient.
          </span>
        </label>

        {/* Terms list (read-only) */}
        <details className="text-xs">
          <summary className="cursor-pointer font-medium mb-1" style={{ color: BRAND_COLORS.primaryTeal }}>
            View full Terms & Conditions
          </summary>
          <ol className="list-decimal ml-4 space-y-1 mt-2" style={{ color: BRAND_COLORS.secondaryText }}>
            {PAYMENT_TERMS.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </details>

        {/* Save feedback */}
        {state.error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 py-2">
            <AlertDescription className="text-sm">{state.error}</AlertDescription>
          </Alert>
        )}
        {state.success && (
          <Alert className="border-green-200 bg-green-50 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-700">Agreement saved successfully.</AlertDescription>
          </Alert>
        )}

        {/* Save + Reset actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-6 text-sm font-semibold text-white gap-2"
            style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Save Agreement
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetToSuggested}
            className="h-9 px-4 text-xs gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Suggested
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
