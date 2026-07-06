"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight, FileText, ClipboardList, FileSignature,
  CheckCircle2, ArrowLeft, ArrowRight, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrescriptionEditor, ExamTemplate } from "@/components/prescriptions/PrescriptionEditor"
import { PaymentAgreementCard } from "@/components/estimates/PaymentAgreementCard"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { updateQueueStatusAction } from "@/actions/queue"
import { toast } from "sonner"
import type { PrescriptionData } from "@/lib/prescription-types"
import type { PaymentStage } from "@/lib/payment-agreement"

interface EstimateItem {
  id: string
  treatmentName: string
  category: string
  toothNumber: string | null
  quantity: number
  unitRate: number
  amount: number
  status: string
}

interface Props {
  estimateId: string
  estimateNo: string
  estimateItems: EstimateItem[]
  estimateTotal: number
  estimateSubtotal: number
  estimateDiscount: number | null
  estimateNotes: string | null
  patientName: string
  patientId: string
  visitId: string
  doctorName: string
  branchName: string
  prescriptionId: string | null
  prescriptionData: PrescriptionData
  initialTemplates: ExamTemplate[]
  paymentAgreementStages: PaymentStage[]
  paymentAgreementRep: string | null
  paymentAgreementTermsAccepted: boolean
  paymentAgreementSignedAt: string | null
  queueId: string | null
}

const STEPS = [
  { n: 1, label: "Estimate", icon: FileText },
  { n: 2, label: "Prescription", icon: ClipboardList },
  { n: 3, label: "Payment Plan", icon: FileSignature },
]

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#92400E",
  IN_PROGRESS: "#1E40AF",
  COMPLETED: "#065F46",
  CANCELLED: "#707882",
}
const STATUS_BG: Record<string, string> = {
  PENDING: "#FEF3C7",
  IN_PROGRESS: "#DBEAFE",
  COMPLETED: "#D1FAE5",
  CANCELLED: "#F2F4F6",
}

export function EstimateWizard({
  estimateId, estimateNo,
  estimateItems, estimateTotal, estimateSubtotal, estimateDiscount, estimateNotes,
  patientName, patientId, visitId, doctorName, branchName,
  prescriptionId, prescriptionData, initialTemplates,
  paymentAgreementStages, paymentAgreementRep, paymentAgreementTermsAccepted, paymentAgreementSignedAt,
  queueId,
}: Props) {
  const [step, setStep] = useState(1)
  const [isCompleting, startCompleting] = useTransition()
  const router = useRouter()
  const prescriptionFormRef = useRef<HTMLFormElement>(null)
  const [prescriptionSaved, setPrescriptionSaved] = useState(false)
  const pendingNextRef = useRef(false)

  function handleComplete() {
    if (!queueId) {
      router.push("/doctor")
      return
    }
    startCompleting(async () => {
      const result = await updateQueueStatusAction(queueId, "ESTIMATE_CREATED")
      if (result.success) {
        toast.success("Visit completed — patient sent to payment")
        router.push("/doctor")
      } else {
        toast.error(result.error ?? "Failed to complete visit")
      }
    })
  }

  function triggerPrescriptionSave() {
    prescriptionFormRef.current?.requestSubmit()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Step indicator */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] p-4 flex items-center gap-1">
        {STEPS.map(({ n, label, icon: Icon }, idx) => {
          const done = n < step
          const active = n === step
          return (
            <div key={n} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => setStep(n)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg w-full transition-all"
                style={{
                  backgroundColor: active ? `${BRAND_COLORS.primaryTeal}15` : "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: done
                      ? BRAND_COLORS.secondaryGreen
                      : active
                      ? BRAND_COLORS.primaryTeal
                      : BRAND_COLORS.borderDivider,
                    color: "white",
                  }}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </span>
                <div className="text-left">
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: active ? BRAND_COLORS.primaryTeal : done ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.borderDivider }}
                  >
                    Step {n}
                  </p>
                  <p
                    className="text-sm font-medium leading-tight"
                    style={{ color: active ? BRAND_COLORS.primaryTeal : done ? BRAND_COLORS.bodyText : BRAND_COLORS.borderDivider }}
                  >
                    {label}
                  </p>
                </div>
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 mx-1" style={{ color: BRAND_COLORS.borderDivider }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Estimate Summary ─────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-[#E0E3E5] overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                {estimateNo}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {patientName} · {branchName} · Dr. {doctorName.replace(/^Dr\.?\s*/i, "")}
              </p>
            </div>
            <a
              href={`/doctor/estimate/${estimateId}`}
              className="text-xs font-medium hover:underline"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              Edit Estimate →
            </a>
          </div>
          <div className="px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["#", "Treatment", "Tooth", "Qty", "Rate", "Amount", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-semibold"
                      style={{ color: BRAND_COLORS.borderDivider, borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimateItems.map((item, idx) => (
                  <tr key={item.id} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <td className="py-2 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{idx + 1}</td>
                    <td className="py-2 px-2">
                      <p className="font-medium text-sm" style={{ color: BRAND_COLORS.bodyText }}>{item.treatmentName}</p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{item.category}</p>
                    </td>
                    <td className="py-2 px-2 text-xs font-mono" style={{ color: BRAND_COLORS.primaryTeal }}>
                      {item.toothNumber || "—"}
                    </td>
                    <td className="py-2 px-2 text-xs text-center" style={{ color: BRAND_COLORS.bodyText }}>{item.quantity}</td>
                    <td className="py-2 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(item.unitRate)}</td>
                    <td className="py-2 px-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(item.amount)}</td>
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: STATUS_BG[item.status] ?? "#F2F4F6", color: STATUS_COLOR[item.status] ?? "#707882" }}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 max-w-xs ml-auto space-y-1.5 text-sm">
              {estimateDiscount && (
                <div className="flex justify-between">
                  <span style={{ color: BRAND_COLORS.borderDivider }}>Subtotal</span>
                  <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(estimateSubtotal)}</span>
                </div>
              )}
              {estimateDiscount && (
                <div className="flex justify-between">
                  <span style={{ color: BRAND_COLORS.borderDivider }}>Discount ({estimateDiscount}%)</span>
                  <span className="text-red-500">-{formatCurrency(estimateSubtotal * estimateDiscount / 100)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1.5 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                <span style={{ color: BRAND_COLORS.bodyText }}>Total</span>
                <span style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(estimateTotal)}</span>
              </div>
            </div>

            {estimateNotes && (
              <p className="mt-3 text-xs p-2 rounded" style={{ backgroundColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.borderDivider }}>
                Notes: {estimateNotes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: Prescription ─────────────────────────────────── */}
      {step === 2 && prescriptionId && (
        <div className="bg-white rounded-xl border border-[#E0E3E5] overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-4 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Step 2 — Prescription
            </h2>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              Fill chief complaint, examination findings, and prescribe medicines. Save, then click Next.
            </p>
          </div>
          <div className="px-6 py-4">
            <PrescriptionEditor
              prescriptionId={prescriptionId}
              data={prescriptionData}
              canEdit={true}
              initialTemplates={initialTemplates}
              formRef={prescriptionFormRef}
              onSaveSuccess={() => {
                setPrescriptionSaved(true)
                if (pendingNextRef.current) {
                  pendingNextRef.current = false
                  setStep(3)
                }
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && !prescriptionId && (
        <div className="bg-white rounded-xl border border-[#E0E3E5] p-8 text-center">
          <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
            No prescription found. Go back and ensure the estimate was saved.
          </p>
        </div>
      )}

      {/* ── STEP 3: Payment Agreement ────────────────────────────── */}
      {step === 3 && (
        <PaymentAgreementCard
          estimateId={estimateId}
          estimateTotal={estimateTotal}
          initialStages={paymentAgreementStages}
          initialRep={paymentAgreementRep}
          initialTermsAccepted={paymentAgreementTermsAccepted}
          initialPatientSignedAt={paymentAgreementSignedAt}
          estimateNo={estimateNo}
          patientName={patientName}
          doctorName={doctorName}
        />
      )}

      {/* ── Navigation bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {step === 1 && (
            <a href="/doctor" className="text-sm font-medium hover:underline" style={{ color: BRAND_COLORS.borderDivider }}>
              ← Queue
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Print prescription shortcut on step 2 */}
          {step === 2 && prescriptionId && (
            <a
              href={`/print/prescription/${visitId}`}
              target="_blank"
              className="text-sm font-medium hover:underline"
              style={{ color: BRAND_COLORS.borderDivider }}
            >
              Print Rx
            </a>
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 2 && prescriptionFormRef.current) {
                  pendingNextRef.current = true
                  prescriptionFormRef.current.requestSubmit()
                } else {
                  setStep((s) => s + 1)
                }
              }}
              className="gap-2 text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {step === 2 ? "Save & Next" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              className="gap-2 text-white px-6"
              style={{ backgroundColor: isCompleting ? BRAND_COLORS.borderDivider : "#1A6B4A" }}
            >
              {isCompleting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Completing…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />Save & Complete</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
