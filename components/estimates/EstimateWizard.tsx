"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight, ClipboardList, FileText, FileSignature,
  CheckCircle2, ArrowLeft, ArrowRight, Loader2, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/shared/BackButton"
import { BookFollowUpDialog } from "@/components/appointments/BookFollowUpDialog"
import { PrescriptionEditor, ExamTemplate, TreatmentOption, PrescriptionEditorHandle } from "@/components/prescriptions/PrescriptionEditor"
import { EstimateBuilder } from "@/components/estimates/EstimateBuilder"
import { PaymentAgreementCard, type PaymentAgreementCardHandle } from "@/components/estimates/PaymentAgreementCard"
import { BRAND_COLORS } from "@/lib/constants"
import { updateQueueStatusAction } from "@/actions/queue"
import { toast } from "sonner"
import type { PrescriptionData, PrescriptionTreatment } from "@/lib/prescription-types"
import type { PaymentStage } from "@/lib/payment-agreement"

interface WizardEstimateItem {
  id: string
  treatmentId: string | null
  treatmentName: string
  category: string
  toothNumber: string | null
  quantity: number
  unitRate: number
  plannedSittings: number
  status: string
}

interface Props {
  estimateId: string | null
  estimateNo: string | null
  estimateItems: WizardEstimateItem[]
  estimateNotes: string | null
  estimateDiscount: number | null
  /** Total the server stored (already discounted); null before the estimate exists */
  estimateTotal: number | null
  patientName: string
  patientId: string
  visitId: string
  /** Human-readable VISIT-YYYY-NNNNN — the raw uuid must never reach the UI */
  visitNo: string
  branchId: string
  doctorName: string
  branchName: string
  prescriptionId: string | null
  prescriptionData: PrescriptionData
  previousPrescription: Pick<PrescriptionData, "chiefComplaint" | "onExamination" | "treatments" | "medicines" | "advice"> | null
  initialTemplates: ExamTemplate[]
  treatments: TreatmentOption[]
  allowDiscount: boolean
  paymentAgreementStages: PaymentStage[]
  paymentAgreementRep: string | null
  paymentAgreementTermsAccepted: boolean
  paymentAgreementSignedAt: string | null
  queueId: string | null
}

const STEPS = [
  { n: 1, label: "Prescription", icon: ClipboardList },
  { n: 2, label: "Estimate", icon: FileText },
  { n: 3, label: "Payment Plan", icon: FileSignature },
]

export function EstimateWizard({
  estimateId, estimateNo,
  estimateItems, estimateNotes, estimateDiscount, estimateTotal,
  patientName, patientId, visitId, visitNo, branchId, doctorName, branchName,
  prescriptionId, prescriptionData, previousPrescription, initialTemplates,
  treatments, allowDiscount,
  paymentAgreementStages, paymentAgreementRep, paymentAgreementTermsAccepted, paymentAgreementSignedAt,
  queueId,
}: Props) {
  const [step, setStep] = useState(1)
  const [isFinishing, startFinishing] = useTransition()
  const router = useRouter()
  const prescRef = useRef<PrescriptionEditorHandle>(null)
  const agreementRef = useRef<PaymentAgreementCardHandle>(null)

  // The estimate is created lazily — only once the doctor saves the Estimate step.
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(estimateId)
  const hasEstimate = !!currentEstimateId

  // Treatments flow from the prescription into the estimate. Keep it live as step 1 is edited.
  const [liveTreatments, setLiveTreatments] = useState<PrescriptionTreatment[]>(
    prescriptionData.treatments ?? []
  )

  // Estimate step initial items: existing estimate items if any, else derived
  // from the prescription's treatment plan (rate pulled from the master list).
  const estimateInitialItems = useMemo(() => {
    if (estimateItems.length > 0) {
      return estimateItems.map((i) => ({
        id: i.id,
        treatmentId: i.treatmentId ?? "",
        treatmentName: i.treatmentName,
        category: i.category,
        toothNumber: i.toothNumber ?? "",
        quantity: i.quantity,
        unitRate: i.unitRate,
        plannedSittings: i.plannedSittings,
      }))
    }
    return liveTreatments
      .filter((t) => t.treatmentName.trim())
      .map((t) => {
        const master = treatments.find((m) => m.id === t.treatmentId)
        return {
          treatmentId: t.treatmentId ?? "",
          treatmentName: t.treatmentName,
          category: t.category || master?.category || "OTHER",
          toothNumber: t.toothNumber ?? "",
          quantity: t.quantity,
          unitRate: master?.defaultAmount ?? 0,
          plannedSittings: 1,
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, estimateItems, liveTreatments, treatments])

  /**
   * What the patient actually owes, for the payment plan. Prefer the total the
   * server stored — it is the one the estimate and the printout show. The
   * previous version summed quantity × rate on the client and ignored the
   * discount, so a discounted estimate produced a payment schedule for the
   * full, pre-discount amount.
   */
  /** Pre-discount sum of the treatment rows, for the discount box in step 3. */
  const estimateSubtotal = useMemo(
    () => estimateInitialItems.reduce((s, i) => s + i.quantity * i.unitRate, 0),
    [estimateInitialItems]
  )

  const agreementTotal = useMemo(() => {
    if (estimateTotal !== null && Number.isFinite(estimateTotal)) return estimateTotal
    const subtotal = estimateInitialItems.reduce((s, i) => s + i.quantity * i.unitRate, 0)
    const pct = estimateDiscount ?? 0
    return pct > 0 ? subtotal - (subtotal * pct) / 100 : subtotal
  }, [estimateTotal, estimateInitialItems, estimateDiscount])

  async function savePrescriptionThen(next: () => void) {
    if (!prescriptionId) { next(); return }
    const ok = await prescRef.current?.save()
    if (ok) next()
    else toast.error("Could not save prescription — please review the entries.")
  }

  // Rx-only: complete the consultation with just the prescription. No estimate,
  // no agreement, no payment step. Patient can consult again later.
  function finishRxOnly() {
    startFinishing(async () => {
      if (!queueId) { router.push("/doctor"); return }
      const result = await updateQueueStatusAction(queueId, "COMPLETED")
      if (result.success) {
        toast.success("Consultation completed (prescription only)")
        router.push("/doctor")
      } else {
        toast.error(result.error ?? "Failed to complete consultation")
      }
    })
  }

  // Estimate exists → save agreement and complete the consultation. The
  // consultation fee is already paid, so the queue entry is marked COMPLETED
  // (no reception "Collect"/"Cancel"). Treatment payment is collected later from
  // the patient's Payments tab, following the agreed schedule.
  function completeWithEstimate() {
    startFinishing(async () => {
      agreementRef.current?.save()
      if (!queueId) { router.push("/doctor"); return }
      const result = await updateQueueStatusAction(queueId, "COMPLETED")
      if (result.success) {
        toast.success("Consultation completed")
        router.push("/doctor")
      } else {
        toast.error(result.error ?? "Failed to complete consultation")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header — back, patient, book follow-up, and the step pills in one card */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] p-3 space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <BackButton fallbackHref="/doctor" />
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium hidden sm:block" style={{ color: BRAND_COLORS.bodyText }}>{patientName}</p>
            <BookFollowUpDialog patientId={patientId} branchId={branchId} patientName={patientName} />
          </div>
        </div>
        <div className="flex items-center gap-1 border-t pt-2" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        {STEPS.map(({ n, label, icon: Icon }, idx) => {
          const done = n < step
          const active = n === step
          return (
            <div key={n} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => setStep(n)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg w-full transition-all"
                style={{ backgroundColor: active ? `${BRAND_COLORS.primaryTeal}15` : "transparent", cursor: "pointer" }}
              >
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: done ? BRAND_COLORS.secondaryGreen : active ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderDivider,
                    color: "white",
                  }}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </span>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight"
                    style={{ color: active ? BRAND_COLORS.primaryTeal : done ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.borderDivider }}>
                    Step {n}
                  </p>
                  <p className="text-sm font-medium leading-tight"
                    style={{ color: active ? BRAND_COLORS.primaryTeal : done ? BRAND_COLORS.bodyText : BRAND_COLORS.borderDivider }}>
                    {label}
                  </p>
                </div>
                <Icon className="h-4 w-4 ml-auto hidden sm:block" style={{ color: active ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderDivider }} />
              </button>
              {idx < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 mx-1" style={{ color: BRAND_COLORS.borderDivider }} />
              )}
            </div>
          )
        })}
        </div>
      </div>

      {/* ── STEP 1: Prescription ─────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-[#E0E3E5] overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                Step 1 — Prescription
              </h2>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {patientName} · {branchName} · Dr. {doctorName.replace(/^Dr\.?\s*/i, "")}
              </p>
            </div>
            {prescriptionId && (
              <a href={`/print/prescription/${visitId}`} target="_blank"
                className="text-xs font-medium hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
                Print Rx
              </a>
            )}
          </div>
          <div className="px-6 py-4">
            {prescriptionId ? (
              <PrescriptionEditor
                ref={prescRef}
                prescriptionId={prescriptionId}
                data={prescriptionData}
                canEdit={true}
                initialTemplates={initialTemplates}
                treatments={treatments}
                onTreatmentsChange={setLiveTreatments}
                previousData={previousPrescription}
              />
            ) : (
              <p className="text-sm py-6 text-center" style={{ color: BRAND_COLORS.borderDivider }}>
                No prescription found for this visit.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: Estimate ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-[#E0E3E5] overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-4 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Step 2 — Treatment Estimate {estimateNo ? `(${estimateNo})` : "(optional)"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              Treatments carried over from the prescription. Set the rate and number of sittings for each, then Save.
              Skip this if the patient only needs a prescription.
            </p>
          </div>
          <div className="px-6 py-4">
            <EstimateBuilder
              mode="wizard"
              estimateId={currentEstimateId ?? undefined}
              patientId={patientId}
              visitId={visitId}
              branchId={branchId}
              patientName={patientName}
              visitNo={visitNo}
              doctorName={doctorName}
              treatments={treatments}
              allowDiscount={allowDiscount}
              initialItems={estimateInitialItems}
              initialNotes={estimateNotes ?? ""}
              initialDiscountPercent={estimateDiscount ?? 0}
              submitLabel={hasEstimate ? "Save Estimate" : "Create Estimate"}
              onSaved={(id) => { setCurrentEstimateId(id); toast.success("Estimate saved — finish now, or add a payment plan"); router.refresh() }}
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: Treatment Agreement ──────────────────────────── */}
      {step === 3 && (
        hasEstimate ? (
          <PaymentAgreementCard
            ref={agreementRef}
            estimateId={currentEstimateId!}
            estimateTotal={agreementTotal}
            estimateSubtotal={estimateSubtotal}
            initialDiscountPercent={estimateDiscount ?? 0}
            allowDiscount={allowDiscount}
            initialStages={paymentAgreementStages}
            initialRep={paymentAgreementRep}
            initialTermsAccepted={paymentAgreementTermsAccepted}
            initialPatientSignedAt={paymentAgreementSignedAt}
            estimateNo={estimateNo ?? ""}
            patientName={patientName}
            doctorName={doctorName}
          />
        ) : (
          <div className="bg-white rounded-xl border border-[#E0E3E5] p-8 text-center space-y-2">
            <Lock className="h-8 w-8 mx-auto" style={{ color: BRAND_COLORS.borderDivider }} />
            <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              No estimate yet
            </p>
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              A payment agreement is only needed when there&apos;s a treatment estimate.
              Go back to Step 2 to create one, or finish with the prescription only.
            </p>
          </div>
        )
      )}

      {/* ── Navigation bar ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />Previous step
            </Button>
          ) : (
            <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Step {step} of 3</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step === 1 && (
            <>
              {!hasEstimate && (
                <Button type="button" variant="outline" onClick={finishRxOnly} disabled={isFinishing} className="gap-2">
                  {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finish (Prescription only)
                </Button>
              )}
              <Button
                type="button"
                onClick={() => savePrescriptionThen(() => setStep(2))}
                className="gap-2 text-white"
                style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
              >
                Save &amp; Next: Estimate <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              {!hasEstimate ? (
                <Button type="button" variant="outline" onClick={finishRxOnly} disabled={isFinishing} className="gap-2">
                  {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finish (Prescription only)
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={completeWithEstimate} disabled={isFinishing} className="gap-2 text-white"
                    style={{ backgroundColor: isFinishing ? BRAND_COLORS.borderDivider : BRAND_COLORS.secondaryGreen }}>
                    {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Finish (no payment plan)
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setStep(3)} className="gap-2">
                    Add payment plan <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </>
          )}
          {step === 3 && hasEstimate && (
            <Button
              type="button"
              onClick={completeWithEstimate}
              disabled={isFinishing}
              className="gap-2 text-white px-6"
              style={{ backgroundColor: isFinishing ? BRAND_COLORS.borderDivider : BRAND_COLORS.secondaryGreen }}
            >
              {isFinishing ? <><Loader2 className="h-4 w-4 animate-spin" />Completing…</> : <><CheckCircle2 className="h-4 w-4" />Save &amp; Complete</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
