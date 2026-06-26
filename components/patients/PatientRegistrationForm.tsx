"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { registerPatientAction, PatientFormState } from "@/actions/patients"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
  defaultBranchId: string
  isAdmin: boolean
}

const LEAD_SOURCES = [
  "Walk-in", "Referral", "Online", "Social Media", "Google", "Friend / Family", "Other",
]

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
        "Register Patient"
      )}
    </Button>
  )
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return <p className="text-xs text-red-600 mt-1">{errors[0]}</p>
}

// Reusable native input to avoid @base-ui/react uncontrolled→controlled warning
const inputCls = "w-full h-10 rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8]"
const selectCls = "w-full h-10 rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8]"
const labelCls = "block text-sm font-medium mb-1"

export function PatientRegistrationForm({ branches, defaultBranchId, isAdmin }: Props) {
  const [state, formAction] = useActionState(registerPatientAction, {} as PatientFormState)
  const [leadSource, setLeadSource] = useState(state.fields?.leadSource ?? "")

  const fe = state.fieldErrors ?? {}
  const f = state.fields ?? {}

  return (
    <form action={formAction} className="space-y-8">
      {/* Global error */}
      {state.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {!isAdmin && (
        <input type="hidden" name="registrationBranchId" value={defaultBranchId} />
      )}

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
                    className="accent-[#4ABCC8]"
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
              className="w-full rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8] resize-none"
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
              className="w-full rounded-md border border-[#CCCCCC] bg-[#EBECEE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ABCC8] resize-none"
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <SubmitButton />
        <a href="/patients" className="text-sm font-medium hover:underline" style={{ color: BRAND_COLORS.borderDivider }}>
          Cancel
        </a>
      </div>
    </form>
  )
}
