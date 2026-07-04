"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BRAND_COLORS } from "@/lib/constants"
import type { DentalHistory } from "@prisma/client"

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

interface CheckRowProps {
  name: string
  label: string
  defaultChecked: boolean
  children?: React.ReactNode
}

function CheckRow({ name, label, defaultChecked, children }: CheckRowProps) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="h-4 w-4 rounded accent-[#0077BE]"
        />
        <span className="text-sm group-hover:text-[#0077BE] transition-colors" style={{ color: BRAND_COLORS.bodyText }}>
          {label}
        </span>
      </label>
      {checked && children && (
        <div className="ml-6">{children}</div>
      )}
    </div>
  )
}

const inputClass = "h-9 border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6] mt-1"
const taClass = "border-[#E0E3E5] focus-visible:ring-[#0077BE] text-sm bg-[#F2F4F6] resize-none"

interface Props {
  existing: DentalHistory | null
}

/**
 * The full set of dental-history form fields (medical conditions, medications,
 * dental history, consent) WITHOUT a <form> wrapper — usable inside both the
 * standalone DentalHistoryForm and the patient registration wizard.
 */
export function DentalHistoryFields({ existing }: Props) {
  const d = existing

  return (
    <>
      {/* ── SECTION 1: MEDICAL CONDITIONS ─────────────────────── */}
      <div className="space-y-3">
        <SectionHeading>Medical History — Please check all that apply</SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pt-1">
          <CheckRow name="allergies" label="Allergies" defaultChecked={d?.allergies ?? false}>
            <Input name="allergiesDetail" defaultValue={d?.allergiesDetail ?? ""} placeholder="Specify allergy" className={inputClass} />
          </CheckRow>

          <CheckRow name="diabetes" label="Diabetes" defaultChecked={d?.diabetes ?? false} />

          <CheckRow name="epilepsy" label="Epilepsy / Seizures" defaultChecked={d?.epilepsy ?? false}>
            <Input name="epilepsyDetail" defaultValue={d?.epilepsyDetail ?? ""} placeholder="Details" className={inputClass} />
          </CheckRow>

          <CheckRow name="fainting" label="Fainting / Blackouts" defaultChecked={d?.fainting ?? false} />

          <CheckRow name="hepatitis" label="Hepatitis" defaultChecked={d?.hepatitis ?? false}>
            <div className="flex gap-4 mt-1">
              {["B", "C"].map((type) => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="hepatitisType"
                    value={type}
                    defaultChecked={d?.hepatitisType === type}
                    className="accent-[#0077BE]"
                  />
                  <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Type {type}</span>
                </label>
              ))}
            </div>
          </CheckRow>

          <CheckRow name="hivAids" label="HIV / AIDS" defaultChecked={d?.hivAids ?? false} />

          <CheckRow name="heartProblems" label="Heart Problems" defaultChecked={d?.heartProblems ?? false}>
            <Input name="heartProblemsDetail" defaultValue={d?.heartProblemsDetail ?? ""} placeholder="Specify condition" className={inputClass} />
          </CheckRow>

          <CheckRow name="heartSurgery" label="Heart Surgery" defaultChecked={d?.heartSurgery ?? false}>
            <Input name="heartSurgeryDetail" defaultValue={d?.heartSurgeryDetail ?? ""} placeholder="Type of surgery" className={inputClass} />
          </CheckRow>

          <CheckRow name="bloodPressure" label="Blood Pressure" defaultChecked={d?.bloodPressure ?? false}>
            <div className="flex gap-4 mt-1">
              {[["HIGH", "High"], ["LOW", "Low"]].map(([val, label]) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="bloodPressureType"
                    value={val}
                    defaultChecked={d?.bloodPressureType === val}
                    className="accent-[#0077BE]"
                  />
                  <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{label}</span>
                </label>
              ))}
            </div>
          </CheckRow>

          <CheckRow name="kidneyLiver" label="Kidney / Liver Disease" defaultChecked={d?.kidneyLiver ?? false} />
          <CheckRow name="respiratory" label="Respiratory Problems / Asthma" defaultChecked={d?.respiratory ?? false} />
          <CheckRow name="sinus" label="Sinus Problems" defaultChecked={d?.sinus ?? false} />
          <CheckRow name="bleedsEasily" label="Bleeds Easily / Clotting Disorder" defaultChecked={d?.bleedsEasily ?? false} />
          <CheckRow name="smoker" label="Smoker / Tobacco User" defaultChecked={d?.smoker ?? false} />
          <CheckRow name="pregnant" label="Pregnant / Nursing" defaultChecked={d?.pregnant ?? false} />
        </div>
      </div>

      {/* ── SECTION 2: MEDICATIONS & NOTES ────────────────────── */}
      <div className="space-y-3">
        <SectionHeading>Current Medications & Other Conditions</SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Current Medications
            </Label>
            <Textarea
              name="currentMedications"
              defaultValue={d?.currentMedications ?? ""}
              placeholder="List all current medications and dosages"
              className={taClass}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Other Medical Conditions
            </Label>
            <Textarea
              name="otherDisease"
              defaultValue={d?.otherDisease ?? ""}
              placeholder="Any other medical conditions not listed above"
              className={taClass}
              rows={3}
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              General Health Notes
            </Label>
            <Textarea
              name="generalHealthNotes"
              defaultValue={d?.generalHealthNotes ?? ""}
              placeholder="Any additional health information"
              className={taClass}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: DENTAL HISTORY ─────────────────────────── */}
      <div className="space-y-3">
        <SectionHeading>Dental History</SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Reason for Dental Visit
            </Label>
            <Textarea
              name="dentalReasonForVisit"
              defaultValue={d?.dentalReasonForVisit ?? ""}
              placeholder="What brings the patient in today?"
              className={taClass}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Previous Dental Treatment
            </Label>
            <Textarea
              name="previousTreatment"
              defaultValue={d?.previousTreatment ?? ""}
              placeholder="Describe any previous dental work"
              className={taClass}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Last Dentist Visit
            </Label>
            <Input
              name="lastDentistVisit"
              defaultValue={d?.lastDentistVisit ?? ""}
              placeholder="e.g., 6 months ago, 2023"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              Last Dental X-Ray
            </Label>
            <Input
              name="lastXRay"
              defaultValue={d?.lastXRay ?? ""}
              placeholder="e.g., 1 year ago, never"
              className={inputClass}
            />
          </div>
        </div>

        {/* Dental symptoms checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pt-2">
          {[
            { name: "foodCatching", label: "Food catching between teeth", val: d?.foodCatching },
            { name: "gumsBleed", label: "Gums bleed when brushing/flossing", val: d?.gumsBleed },
            { name: "looseTeeth", label: "Loose or shifting teeth", val: d?.looseTeeth },
            { name: "sensitiveTeeth", label: "Sensitive teeth (hot / cold / sweet)", val: d?.sensitiveTeeth },
            { name: "grinding", label: "Grinding or clenching teeth", val: d?.grinding },
            { name: "jawPain", label: "Jaw pain or clicking (TMJ)", val: d?.jawPain },
            { name: "snoring", label: "Snoring / sleep apnea", val: d?.snoring },
            { name: "appearanceConcern", label: "Cosmetic / appearance concerns", val: d?.appearanceConcern },
            { name: "seenSpecialist", label: "Previously seen a dental specialist", val: d?.seenSpecialist },
            { name: "wisdomTeethRemoved", label: "Wisdom teeth removed", val: d?.wisdomTeethRemoved },
          ].map(({ name, label, val }) => (
            <CheckRow key={name} name={name} label={label} defaultChecked={val ?? false} />
          ))}
        </div>
      </div>

      {/* ── SECTION 4: CONSENT ────────────────────────────────── */}
      <div
        className="rounded-lg border p-4 space-y-4"
        style={{ borderColor: BRAND_COLORS.primaryTeal, backgroundColor: `${BRAND_COLORS.primaryTeal}08` }}
      >
        <SectionHeading>Patient Declaration &amp; Consent</SectionHeading>

        <p className="text-sm leading-relaxed" style={{ color: BRAND_COLORS.bodyText }}>
          I declare that the information provided above is correct and complete to the best of my
          knowledge. I understand that it is my responsibility to inform the dental staff of any
          changes in my medical status. I consent to the proposed dental treatment and acknowledge
          that the risks, benefits, and alternatives have been explained to me.
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="consentGiven"
            required
            defaultChecked={d?.consentGiven ?? false}
            className="h-4 w-4 mt-0.5 accent-[#0077BE]"
          />
          <span className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            Patient has read, understood, and given consent <span className="text-red-500">*</span>
          </span>
        </label>
      </div>
    </>
  )
}
