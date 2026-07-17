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

function SubmitBtn() {
  const { pending } = useFormStatus()
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

export function BookingForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useActionState(submitAppointmentRequestAction, {} as BookingFormState)
  const [branchId, setBranchId] = useState(state.fields?.branchId ?? "")
  const fe = state.fieldErrors ?? {}
  const f = state.fields ?? {}
  const today = new Date().toISOString().split("T")[0]

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="flex gap-2 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{state.error}</p>
        </div>
      )}

      {/* Clinic — pick as colour cards */}
      <div>
        <label className={labelCls}>Choose your clinic</label>
        <input type="hidden" name="branchId" value={branchId} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {branches.map((b) => {
            const c = branchColor(b.name)
            const active = branchId === b.id
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
          <label className={labelCls}>Your name</label>
          <input name="fullName" type="text" required defaultValue={f.fullName ?? ""} placeholder="Full name" className={fieldCls} maxLength={200} />
          {fe.fullName && <p className="text-xs text-red-500 mt-1.5">{fe.fullName[0]}</p>}
        </div>
        <div>
          <label className={labelCls}>Mobile number</label>
          <input name="mobile" type="tel" required defaultValue={f.mobile ?? ""} placeholder="10-digit number" className={fieldCls} maxLength={15} />
          {fe.mobile && <p className="text-xs text-red-500 mt-1.5">{fe.mobile[0]}</p>}
        </div>
      </div>

      <div>
        <label className={labelCls}>Preferred date</label>
        <input name="preferredDate" type="date" required defaultValue={f.preferredDate ?? ""} min={today} className={fieldCls} />
        {fe.preferredDate && <p className="text-xs text-red-500 mt-1.5">{fe.preferredDate[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>
          What&apos;s troubling you? <span className="font-normal text-[#707882]">(optional)</span>
        </label>
        <textarea
          name="problem"
          defaultValue={f.problem ?? ""}
          placeholder="e.g. toothache, cleaning, broken tooth, consultation…"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-[#E0E3E5] bg-white px-4 py-3 text-sm text-[#191C1E] focus:outline-none focus:ring-2 focus:ring-[#005E97] focus:border-transparent resize-none"
        />
      </div>

      {/* WhatsApp opt-in — without this we cannot message the patient at all */}
      <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E0E3E5] bg-white cursor-pointer">
        <input
          type="checkbox"
          name="whatsappConsent"
          defaultChecked={f.whatsappConsent !== "off"}
          className="mt-0.5 h-4 w-4 accent-[#005E97]"
        />
        <span className="text-[13px] text-[#404751]">
          <strong className="text-[#191C1E]">Confirm my appointment on WhatsApp</strong>
          <br />
          I agree to receive my appointment confirmation and reminders from Ur&apos;s Toothfully on WhatsApp.
        </span>
      </label>

      <BotGuardFields />

      <TurnstileWidget />

      <SubmitBtn />

      <p className="text-[11px] text-center text-[#707882] leading-relaxed">
        This is a request — our team will call or WhatsApp you to confirm your slot.
      </p>
    </form>
  )
}
