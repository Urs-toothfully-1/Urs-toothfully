"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { submitAppointmentRequestAction, BookingFormState } from "@/actions/appointment-request"
import { TurnstileWidget } from "@/components/intake/TurnstileWidget"
import { BotGuardFields } from "@/components/shared/BotGuardFields"
import { branchColor } from "@/lib/branch-colors"
import { AlertCircle, Loader2, CalendarCheck, Check } from "lucide-react"

interface Branch {
  id: string
  name: string
  address: string
}

function SubmitBtn({ editorial }: { editorial?: boolean }) {
  const { pending } = useFormStatus()
  if (editorial) {
    return (
      <button
        type="submit"
        disabled={pending}
        className="group w-full flex items-center justify-between gap-6 pl-6 pr-[7px] py-[7px] text-[15px] font-semibold transition-opacity disabled:opacity-70"
        style={{ backgroundColor: "#342822", color: "#f6f1e8" }}
      >
        <span>{pending ? "Sending your request…" : "Request my appointment"}</span>
        <span className="grid h-[42px] w-[42px] place-items-center text-[22px] transition-transform duration-300 group-hover:rotate-45" style={{ backgroundColor: "#b79a73", color: "#342822" }} aria-hidden>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "↗"}
        </span>
      </button>
    )
  }
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-sm transition-all hover:brightness-105 disabled:opacity-70"
      style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}
    >
      {pending ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Requesting…</>
      ) : (
        <><CalendarCheck className="h-4 w-4" />Request Appointment</>
      )}
    </button>
  )
}

const fieldCls =
  "w-full h-12 rounded-xl border border-[#E0E3E5] bg-white px-4 text-sm text-[#191C1E] focus:outline-none focus:ring-2 focus:ring-[#005E97] focus:border-transparent transition-shadow"
const labelCls = "block text-[13px] font-semibold mb-2 text-[#404751]"

// urstoothfully.org look (used by the /rewards invite pages): ivory, espresso, gold, sharp corners.
const ED = {
  field: "w-full h-12 rounded-[2px] border border-[#342822]/20 bg-white px-4 text-[15px] text-[#342822] placeholder:text-[#766b61]/70 focus:outline-none focus:border-[#b79a73] focus:ring-1 focus:ring-[#b79a73] transition-colors",
  label: "block text-[11px] font-medium uppercase tracking-[0.16em] mb-2 text-[#766b61]",
  area: "w-full rounded-[2px] border border-[#342822]/20 bg-white px-4 py-3 text-[15px] text-[#342822] placeholder:text-[#766b61]/70 focus:outline-none focus:border-[#b79a73] focus:ring-1 focus:ring-[#b79a73] resize-none",
}

/** `referralCode` comes from a /rewards/<code> link — submitted so the referral is linked when reception confirms. */
export function BookingForm({ branches, referralCode, editorial = false }: { branches: Branch[]; referralCode?: string; editorial?: boolean }) {
  const field = editorial ? ED.field : fieldCls
  const label = editorial ? ED.label : labelCls
  const [state, formAction] = useActionState(submitAppointmentRequestAction, {} as BookingFormState)
  const [branchId, setBranchId] = useState(state.fields?.branchId ?? "")
  const fe = state.fieldErrors ?? {}
  const f = state.fields ?? {}
  const today = new Date().toISOString().split("T")[0]

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className={`flex gap-2 p-3.5 border border-red-200 bg-red-50 text-red-700 text-sm ${editorial ? "rounded-[2px]" : "rounded-xl"}`}>
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* Clinic — pick as colour cards */}
      <div>
        <label className={label}>Choose your clinic</label>
        <input type="hidden" name="branchId" value={branchId} />
        {referralCode && <input type="hidden" name="referralCode" value={referralCode} />}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {branches.map((b) => {
            const c = branchColor(b.name)
            const active = branchId === b.id
            if (editorial) {
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setBranchId(b.id)}
                  aria-pressed={active}
                  className="relative text-left rounded-[2px] border p-3.5 transition-colors"
                  style={active ? { backgroundColor: "#342822", borderColor: "#342822", color: "#f6f1e8" } : { backgroundColor: "#fff", borderColor: "rgba(52,40,34,.2)", color: "#342822" }}
                >
                  <span className="block text-[15px] font-medium">{b.name}</span>
                  <span className="block text-[11px] mt-1 leading-snug" style={{ color: active ? "rgba(246,241,232,.7)" : "#766b61" }}>{b.address.split(",")[0]}</span>
                  {active && <span className="absolute top-2.5 right-3 text-[13px]" style={{ color: "#b79a73" }}>✦</span>}
                </button>
              )
            }
            return (
              <button
                type="button"
                key={b.id}
                onClick={() => setBranchId(b.id)}
                className="relative text-left rounded-xl border-2 p-3 transition-all"
                style={{
                  backgroundColor: active ? c.bg : "#FFFFFF",
                  borderColor: active ? c.dot : "#E0E3E5",
                }}
              >
                {active && (
                  <span className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center" style={{ backgroundColor: c.dot }}>
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
                  <span className="text-sm font-semibold" style={{ color: active ? c.text : "#191C1E" }}>{b.name}</span>
                </span>
                <span className="block text-[11px] mt-1 leading-snug text-[#707882]">{b.address.split(",")[0]}</span>
              </button>
            )
          })}
        </div>
        {fe.branchId && <p className="text-xs text-red-500 mt-1.5">{fe.branchId[0]}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Your name</label>
          <input name="fullName" type="text" required defaultValue={f.fullName ?? ""} placeholder="Full name" className={field} maxLength={200} />
          {fe.fullName && <p className="text-xs text-red-500 mt-1.5">{fe.fullName[0]}</p>}
        </div>
        <div>
          <label className={label}>Mobile number</label>
          <input name="mobile" type="tel" required defaultValue={f.mobile ?? ""} placeholder="10-digit number" className={field} maxLength={15} />
          {fe.mobile && <p className="text-xs text-red-500 mt-1.5">{fe.mobile[0]}</p>}
        </div>
      </div>

      <div>
        <label className={label}>Preferred date</label>
        <input name="preferredDate" type="date" required defaultValue={f.preferredDate ?? ""} min={today} className={field} />
        {fe.preferredDate && <p className="text-xs text-red-500 mt-1.5">{fe.preferredDate[0]}</p>}
      </div>

      <div>
        <label className={label}>
          What&apos;s troubling you? <span className={editorial ? "normal-case tracking-normal" : "font-normal text-[#707882]"}>(optional)</span>
        </label>
        <textarea
          name="problem"
          defaultValue={f.problem ?? ""}
          placeholder="e.g. toothache, cleaning, broken tooth, consultation…"
          rows={3}
          maxLength={500}
          className={editorial ? ED.area : "w-full rounded-xl border border-[#E0E3E5] bg-white px-4 py-3 text-sm text-[#191C1E] focus:outline-none focus:ring-2 focus:ring-[#005E97] focus:border-transparent resize-none"}
        />
      </div>

      {/* WhatsApp opt-in — without this we cannot message the patient at all */}
      <label className={editorial ? "flex items-start gap-3 p-3.5 rounded-[2px] border border-[#342822]/15 bg-white/70 cursor-pointer" : "flex items-start gap-2.5 p-3 rounded-xl border border-[#E0E3E5] bg-white cursor-pointer"}>
        <input
          type="checkbox"
          name="whatsappConsent"
          defaultChecked={f.whatsappConsent !== "off"}
          className={`mt-0.5 h-4 w-4 ${editorial ? "accent-[#342822]" : "accent-[#005E97]"}`}
        />
        <span className={`text-[13px] ${editorial ? "text-[#766b61]" : "text-[#404751]"}`}>
          <strong className={editorial ? "font-medium text-[#342822]" : "text-[#191C1E]"}>Confirm my appointment on WhatsApp</strong>
          <br />
          I agree to receive my appointment confirmation and reminders from Ur&apos;s Toothfully on WhatsApp.
        </span>
      </label>

      <BotGuardFields />

      <TurnstileWidget />

      <SubmitBtn editorial={editorial} />

      <p className={`text-[11px] text-center leading-relaxed ${editorial ? "text-[#766b61] tracking-[0.04em]" : "text-[#707882]"}`}>
        This is a request — our team will call or WhatsApp you to confirm your slot.
      </p>
    </form>
  )
}
