"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { submitIntakeAction, IntakeFormState } from "@/actions/intake"
import { TurnstileWidget } from "@/components/intake/TurnstileWidget"
import { BotGuardFields } from "@/components/shared/BotGuardFields"
import { BRAND_COLORS } from "@/lib/constants"
import { AlertCircle, Loader2, Send } from "lucide-react"
import { LEAD_SOURCES } from "@/lib/lead-sources"

interface Branch {
  id: string
  name: string
  address: string
  phone: string
}

interface Props {
  branches: Branch[]
  /** Pre-filled referral code from the ?ref= link, and the referrer's first name if valid. */
  defaultReferralCode?: string
  referrerFirstName?: string
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
      style={{ backgroundColor: pending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
      ) : (
        <><Send className="h-4 w-4" />Register Now</>
      )}
    </button>
  )
}

const inputCls = "w-full h-11 rounded-lg border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE]"
const labelCls = "block text-sm font-medium mb-1.5"


export function IntakeForm({ branches, defaultReferralCode = "", referrerFirstName }: Props) {
  const [state, formAction] = useActionState(submitIntakeAction, {} as IntakeFormState)
  const [leadSource, setLeadSource] = useState("")
  const fe = state.fieldErrors ?? {}
  const f = state.fields ?? {}

  return (
    <form action={formAction} className="space-y-6">
      {referrerFirstName && (
        <div className="rounded-lg border p-3 text-sm" style={{ backgroundColor: "#EAF7EF", borderColor: "#A7E3C0", color: "#065F46" }}>
          🎁 Referred by <strong>{referrerFirstName}</strong> — you&apos;ll get a welcome offer.
        </div>
      )}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          Referral Code <span className="font-normal" style={{ color: BRAND_COLORS.borderDivider }}>(optional)</span>
        </label>
        <input
          name="referralCode"
          type="text"
          defaultValue={defaultReferralCode}
          maxLength={12}
          placeholder="e.g. 7K2F9Q"
          className={`${inputCls} uppercase`}
          style={{ textTransform: "uppercase" }}
        />
      </div>
      {state.error && (
        <div className="flex gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* Branch */}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          Which branch will you visit? <span className="text-red-500">*</span>
        </label>
        <select name="branchId" defaultValue={f.branchId ?? ""} required
          className={inputCls}>
          <option value="">Select a branch…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} — {b.address.split(",")[0]}</option>
          ))}
        </select>
        {fe.branchId && <p className="text-xs text-red-500 mt-1">{fe.branchId[0]}</p>}
      </div>

      {/* Full Name */}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          Full Name <span className="text-red-500">*</span>
        </label>
        <input name="fullName" type="text" required defaultValue={f.fullName ?? ""}
          placeholder="Your full name as per ID"
          className={inputCls} maxLength={200} />
        {fe.fullName && <p className="text-xs text-red-500 mt-1">{fe.fullName[0]}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DOB */}
        <div>
          <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input name="dateOfBirth" type="date" required defaultValue={f.dateOfBirth ?? ""}
            max={new Date().toISOString().split("T")[0]}
            className={inputCls} />
          {fe.dateOfBirth && <p className="text-xs text-red-500 mt-1">{fe.dateOfBirth[0]}</p>}
        </div>

        {/* Gender */}
        <div>
          <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
            Gender <span className="text-red-500">*</span>
          </label>
          <select name="gender" required defaultValue={f.gender ?? ""} className={inputCls}>
            <option value="">Select…</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          {fe.gender && <p className="text-xs text-red-500 mt-1">{fe.gender[0]}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mobile */}
        <div>
          <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <input name="mobile" type="tel" required defaultValue={f.mobile ?? ""}
            placeholder="10-digit number"
            className={inputCls} maxLength={15} />
          {fe.mobile && <p className="text-xs text-red-500 mt-1">{fe.mobile[0]}</p>}
        </div>

        {/* Email */}
        <div>
          <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
            Email Address <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>(optional)</span>
          </label>
          <input name="email" type="email" defaultValue={f.email ?? ""}
            placeholder="for appointment reminders"
            className={inputCls} />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          Address <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>(optional)</span>
        </label>
        <textarea name="address" defaultValue={f.address ?? ""}
          placeholder="Your home address"
          rows={2}
          className="w-full rounded-lg border border-[#E0E3E5] bg-[#F2F4F6] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] resize-none" />
      </div>

      {/* How did you find us */}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          How did you find us?
        </label>
        <select name="leadSource" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}
          className={inputCls}>
          <option value="">Select…</option>
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {leadSource === "Referral" && (
        <div>
          <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
            Referred By
          </label>
          <input name="referenceName" type="text" defaultValue={f.referenceName ?? ""}
            placeholder="Name of the person who referred you"
            className={inputCls} maxLength={200} />
        </div>
      )}

      {/* Reason */}
      <div>
        <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
          What brings you to us? <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>(optional)</span>
        </label>
        <textarea name="reasonForVisit" defaultValue={f.reasonForVisit ?? ""}
          placeholder="Describe your dental concern or what treatment you're looking for"
          rows={3}
          className="w-full rounded-lg border border-[#E0E3E5] bg-[#F2F4F6] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077BE] resize-none" />
      </div>

      {/* WhatsApp consent */}
      <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E0E3E5] bg-white cursor-pointer">
        <input
          type="checkbox"
          name="whatsappConsent"
          defaultChecked={f.whatsappConsent === "on"}
          className="mt-0.5 h-4 w-4 accent-[#005E97]"
        />
        <span className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>
          <strong style={{ color: BRAND_COLORS.bodyText }}>Receive WhatsApp Updates</strong>
          <br />
          I agree to receive appointment reminders, receipts and treatment updates from
          Ur&apos;s Toothfully on WhatsApp.
        </span>
      </label>

      {/* Privacy note */}
      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        🔒 Your information is stored securely and used only for your dental care at {" "}
        <strong>Ur&apos;s Toothfully</strong>. We do not share your data with third parties.
      </p>

      <BotGuardFields />

      <TurnstileWidget />

      <SubmitBtn />
    </form>
  )
}
