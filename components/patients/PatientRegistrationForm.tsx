"use client"

import { useActionState, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { registerPatientWithHistoryAction, PatientFormState } from "@/actions/patients"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Loader2, UserSearch } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import { DentalHistoryFields } from "@/components/patients/dental-history/DentalHistoryFields"
import { LEAD_SOURCES } from "@/lib/lead-sources"

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
  defaultBranchId: string
  isAdmin: boolean
}


function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 px-8 font-semibold text-white"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering…</>
      ) : (
        "Submit Registration"
      )}
    </Button>
  )
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-xs text-red-600 mt-1">{errors[0]}</p>
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Personal & Visit Details" },
    { n: 2, label: "Medical & Dental History" },
  ]
  return (
    <div className="flex items-center gap-3">
      {items.map(({ n, label }, i) => {
        const active = step === n
        const done = step > n
        return (
          <div key={n} className="flex items-center gap-3">
            {i > 0 && <div className="w-10 h-px" style={{ backgroundColor: BRAND_COLORS.borderLight }} />}
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white"
                style={{
                  backgroundColor: active || done ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderMedium,
                }}
              >
                {n}
              </span>
              <span
                className="text-sm font-medium hidden sm:inline"
                style={{ color: active ? BRAND_COLORS.bodyText : BRAND_COLORS.borderDivider }}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Reusable native input to avoid @base-ui/react uncontrolled→controlled warning
const inputCls = "w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"
const selectCls = "w-full h-10 rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"
const labelCls = "block text-sm font-medium mb-1"

export function PatientRegistrationForm({ branches, defaultBranchId, isAdmin }: Props) {
  const [state, formAction] = useActionState(registerPatientWithHistoryAction, {} as PatientFormState)
  const [leadSource, setLeadSource] = useState(state.fields?.leadSource ?? "")
  const [step, setStep] = useState<1 | 2>(1)
  const step1Ref = useRef<HTMLDivElement>(null)

  const fe = state.fieldErrors ?? {}
  const f = state.fields ?? {}
  const dup = state.duplicate

  function goToStep2() {
    // Validate only the step-1 fields before advancing
    const fields = step1Ref.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea"
    )
    if (fields) {
      for (const field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity()
          return
        }
      }
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <form action={formAction} className="space-y-8">
      {/* Global error */}
      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Duplicate patient — mobile match blocks registration */}
      {dup?.type === "MOBILE" && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">This mobile number is already registered.</p>
            {dup.matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-1">
                <span>{m.fullName} · {m.patientId} · {m.mobile}</span>
                <Link
                  href={`/patients/${m.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold underline whitespace-nowrap"
                >
                  <UserSearch className="h-3.5 w-3.5" />
                  Open Existing Profile
                </Link>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Possible duplicate — name + DOB / email match, receptionist decides */}
      {dup?.type === "NAME_DOB" && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <p className="font-semibold mb-1">Possible duplicate patient found</p>
            <p className="text-sm mb-2">A patient with the same name and date of birth (or email) already exists:</p>
            {dup.matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span>{m.fullName} · {m.patientId} · {m.mobile}</span>
                <Link href={`/patients/${m.id}`} className="font-semibold underline whitespace-nowrap">
                  Open Existing
                </Link>
              </div>
            ))}
            <div className="flex items-center gap-3 mt-3">
              {/* Submit button name/value rides along with the form data */}
              <Button
                type="submit"
                size="sm"
                name="confirmDuplicate"
                value="true"
                className="h-8 text-white"
                style={{ backgroundColor: "#B45309" }}
              >
                Continue — Register as New Patient
              </Button>
              <Link href="/patients" className="text-sm font-medium underline">Cancel</Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <StepIndicator step={step} />

      {!isAdmin && (
        <input type="hidden" name="registrationBranchId" value={defaultBranchId} />
      )}

      {/* ══ STEP 1: Personal & Visit Information ══════════════ */}
      <div ref={step1Ref} className={step === 1 ? "space-y-8" : "hidden"}>
        {/* ── Personal Information ──────────────────────────── */}
        <section className="space-y-4">
          <h2
            className="text-sm font-bold uppercase tracking-wider pb-2 border-b"
            style={{ color: BRAND_COLORS.primaryTeal, borderColor: BRAND_COLORS.lightBackground }}
          >
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Branch — admin only */}
            {isAdmin && (
              <div className="md:col-span-2">
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Registration Branch <span className="text-red-500">*</span>
                </label>
                <select name="registrationBranchId" defaultValue={defaultBranchId} className={selectCls}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} Branch</option>
                  ))}
                </select>
                <FieldError errors={fe.registrationBranchId} />
              </div>
            )}

            {/* Full Name */}
            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                name="fullName"
                type="text"
                defaultValue={f.fullName ?? ""}
                placeholder="Patient's full name"
                required
                maxLength={200}
                className={inputCls}
              />
              <FieldError errors={fe.fullName} />
            </div>

            {/* DOB */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                name="dateOfBirth"
                type="date"
                defaultValue={f.dateOfBirth ?? ""}
                max={new Date().toISOString().split("T")[0]}
                required
                className={inputCls}
              />
              <FieldError errors={fe.dateOfBirth} />
            </div>

            {/* Gender */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Gender <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6 h-10 items-center">
                {["MALE", "FEMALE", "OTHER"].map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      defaultChecked={f.gender === g}
                      required
                      className="accent-[#0077BE]"
                    />
                    <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </span>
                  </label>
                ))}
              </div>
              <FieldError errors={fe.gender} />
            </div>

            {/* Mobile */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                name="mobile"
                type="tel"
                defaultValue={f.mobile ?? ""}
                placeholder="10-digit mobile number"
                required
                maxLength={15}
                className={inputCls}
              />
              <FieldError errors={fe.mobile} />
            </div>

            {/* Email */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Email Address
              </label>
              <input
                name="email"
                type="email"
                defaultValue={f.email ?? ""}
                placeholder="Optional"
                className={inputCls}
              />
              <FieldError errors={fe.email} />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Address
              </label>
              <textarea
                name="address"
                defaultValue={f.address ?? ""}
                placeholder="Patient's address (optional)"
                rows={2}
                className="w-full rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── Visit Information ─────────────────────────────── */}
        <section className="space-y-4">
          <h2
            className="text-sm font-bold uppercase tracking-wider pb-2 border-b"
            style={{ color: BRAND_COLORS.primaryTeal, borderColor: BRAND_COLORS.lightBackground }}
          >
            Visit Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lead Source */}
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                How did they find us?
              </label>
              <select
                name="leadSource"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className={selectCls}
              >
                <option value="">Select source…</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Reference Name — shown only when Referral */}
            {leadSource === "Referral" && (
              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Referred By
                </label>
                <input
                  name="referenceName"
                  type="text"
                  defaultValue={f.referenceName ?? ""}
                  placeholder="Name of the person who referred"
                  maxLength={200}
                  className={inputCls}
                />
              </div>
            )}

            {/* Referral code — links a reward-eligible referral to an existing patient */}
            {leadSource === "Referral" && (
              <div>
                <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                  Referral Code <span className="font-normal" style={{ color: BRAND_COLORS.borderDivider }}>(optional)</span>
                </label>
                <input
                  name="referralCode"
                  type="text"
                  placeholder="e.g. 7K2F9Q"
                  maxLength={12}
                  className={`${inputCls} uppercase`}
                  style={{ textTransform: "uppercase" }}
                />
                <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                  The referrer&apos;s code — links them to a referral reward.
                </p>
              </div>
            )}

            {/* Reason for Visit */}
            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Chief Complaint / Reason for Visit
              </label>
              <textarea
                name="reasonForVisit"
                defaultValue={f.reasonForVisit ?? ""}
                placeholder="Patient's main dental complaint or reason for visiting"
                rows={3}
                className="w-full rounded-md border border-[#E0E3E5] bg-[#F2F4F6] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] resize-none"
              />
            </div>

            {/* WhatsApp consent */}
            <label className="md:col-span-2 flex items-start gap-2.5 p-3 rounded-md border border-[#E0E3E5] bg-white cursor-pointer">
              <input
                type="checkbox"
                name="whatsappConsent"
                defaultChecked={f.whatsappConsent === "on"}
                className="mt-0.5 h-4 w-4 accent-[#005E97]"
              />
              <span className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>
                <strong style={{ color: BRAND_COLORS.bodyText }}>Receive WhatsApp Updates</strong>
                {" — "}patient agrees to receive appointment reminders, receipts and treatment
                updates on WhatsApp.
              </span>
            </label>
          </div>
        </section>
      </div>

      {/* ══ STEP 2: Medical & Dental History ═════════════════ */}
      <div className={step === 2 ? "space-y-6" : "hidden"}>
        <DentalHistoryFields existing={null} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        {step === 1 ? (
          <Button
            type="button"
            onClick={goToStep2}
            className="h-11 px-8 font-semibold text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            Next: Medical History
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(1)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              className="h-11 px-6 font-semibold"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <SubmitButton />
          </>
        )}
        <Link href="/patients" className="text-sm font-medium hover:underline" style={{ color: BRAND_COLORS.borderDivider }}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
