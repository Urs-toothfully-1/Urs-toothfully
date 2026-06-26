import type { DentalHistory } from "@prisma/client"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { CheckCircle2, XCircle } from "lucide-react"

interface Props {
  history: DentalHistory
  createdByName?: string
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-bold uppercase tracking-wider py-2 px-3 rounded"
      style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
    >
      {children}
    </h3>
  )
}

function BoolRow({ label, value, detail }: { label: string; value: boolean; detail?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {value ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
      ) : (
        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_COLORS.lightBackground }} />
      )}
      <div>
        <span
          className="text-sm"
          style={{ color: value ? BRAND_COLORS.bodyText : BRAND_COLORS.borderDivider }}
        >
          {label}
        </span>
        {value && detail && (
          <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

function TextField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
        {value}
      </p>
    </div>
  )
}

export function DentalHistoryView({ history: h, createdByName }: Props) {
  return (
    <div className="space-y-5">
      {/* Version badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs px-2 py-1 rounded font-medium"
          style={{
            backgroundColor: `${BRAND_COLORS.secondaryGreen}20`,
            color: BRAND_COLORS.secondaryGreen,
          }}
        >
          Version {h.version} {h.isLatest ? "· Latest" : "· Historical"}
        </span>
        <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          Recorded on {formatDate(h.createdAt)}
          {createdByName ? ` by ${createdByName}` : ""}
        </span>
      </div>

      {/* Medical Conditions */}
      <div className="space-y-2">
        <SectionHeading>Medical Conditions</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 pt-1">
          <BoolRow label="Allergies" value={h.allergies} detail={h.allergiesDetail} />
          <BoolRow label="Diabetes" value={h.diabetes} />
          <BoolRow label="Epilepsy / Seizures" value={h.epilepsy} detail={h.epilepsyDetail} />
          <BoolRow label="Fainting / Blackouts" value={h.fainting} />
          <BoolRow
            label={`Hepatitis${h.hepatitisType ? ` Type ${h.hepatitisType}` : ""}`}
            value={h.hepatitis}
          />
          <BoolRow label="HIV / AIDS" value={h.hivAids} />
          <BoolRow label="Heart Problems" value={h.heartProblems} detail={h.heartProblemsDetail} />
          <BoolRow label="Heart Surgery" value={h.heartSurgery} detail={h.heartSurgeryDetail} />
          <BoolRow
            label={`Blood Pressure${h.bloodPressureType ? ` (${h.bloodPressureType})` : ""}`}
            value={h.bloodPressure}
          />
          <BoolRow label="Kidney / Liver Disease" value={h.kidneyLiver} />
          <BoolRow label="Respiratory / Asthma" value={h.respiratory} />
          <BoolRow label="Sinus Problems" value={h.sinus} />
          <BoolRow label="Bleeds Easily" value={h.bleedsEasily} />
          <BoolRow label="Smoker / Tobacco User" value={h.smoker} />
          <BoolRow label="Pregnant / Nursing" value={h.pregnant} />
        </div>
      </div>

      {/* Medications & Notes */}
      {(h.currentMedications || h.otherDisease || h.generalHealthNotes) && (
        <div className="space-y-3">
          <SectionHeading>Medications &amp; Notes</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <TextField label="Current Medications" value={h.currentMedications} />
            <TextField label="Other Medical Conditions" value={h.otherDisease} />
            <TextField label="General Health Notes" value={h.generalHealthNotes} />
          </div>
        </div>
      )}

      {/* Dental History */}
      <div className="space-y-3">
        <SectionHeading>Dental History</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <TextField label="Reason for Visit" value={h.dentalReasonForVisit} />
          <TextField label="Previous Dental Treatment" value={h.previousTreatment} />
          <TextField label="Last Dentist Visit" value={h.lastDentistVisit} />
          <TextField label="Last Dental X-Ray" value={h.lastXRay} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 pt-1">
          <BoolRow label="Food catching between teeth" value={h.foodCatching} />
          <BoolRow label="Gums bleed when brushing" value={h.gumsBleed} />
          <BoolRow label="Loose or shifting teeth" value={h.looseTeeth} />
          <BoolRow label="Sensitive teeth" value={h.sensitiveTeeth} />
          <BoolRow label="Teeth grinding / clenching" value={h.grinding} />
          <BoolRow label="Jaw pain / TMJ" value={h.jawPain} />
          <BoolRow label="Snoring / sleep apnea" value={h.snoring} />
          <BoolRow label="Cosmetic / appearance concerns" value={h.appearanceConcern} />
          <BoolRow label="Previously seen dental specialist" value={h.seenSpecialist} />
          <BoolRow label="Wisdom teeth removed" value={h.wisdomTeethRemoved} />
        </div>
      </div>

      {/* Consent */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: BRAND_COLORS.secondaryGreen, backgroundColor: `${BRAND_COLORS.secondaryGreen}08` }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
          <span className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Patient consent obtained
          </span>
          {h.consentDate && (
            <span className="text-xs ml-2" style={{ color: BRAND_COLORS.borderDivider }}>
              on {formatDate(h.consentDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
