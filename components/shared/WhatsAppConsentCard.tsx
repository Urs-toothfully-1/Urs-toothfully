"use client"

import { useState } from "react"
import { Check } from "lucide-react"

/**
 * The WhatsApp opt-in on the registration forms, styled so patients notice it.
 * Never pre-ticked: consent has to be the patient's own choice. Submits
 * `whatsappConsent=on` like the old checkbox did.
 */
export function WhatsAppConsentCard({
  defaultChecked,
  staff,
  className = "",
}: {
  defaultChecked?: boolean
  /** Staff form: worded as "Patient agrees…" instead of "I agree…". */
  staff?: boolean
  className?: string
}) {
  const [checked, setChecked] = useState(Boolean(defaultChecked))
  return (
    <label
      className={`block cursor-pointer rounded-xl border-2 p-4 transition-colors ${
        checked ? "border-[#25D366] bg-[#E9F9EF]" : "border-[#25D366]/60 bg-[#F4FCF7] hover:bg-[#E9F9EF]"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-[#111B21]">Get updates on WhatsApp</p>
            <span className="rounded-full bg-[#25D366] px-2 py-0.5 text-[11px] font-semibold text-white">
              Recommended
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[#3B4A54]">
            <li>📅 Appointment reminders, so you never miss a visit</li>
            <li>🧾 Receipts, prescriptions &amp; estimates as PDF on your phone</li>
            <li>💬 Chat with the clinic anytime</li>
          </ul>
        </div>
      </div>

      <div
        className={`mt-3 flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          checked ? "border-[#25D366] bg-white" : "border-dashed border-[#25D366] bg-white"
        }`}
      >
        <input
          type="checkbox"
          name="whatsappConsent"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[#25D366]/50 ${
            checked ? "border-[#25D366] bg-[#25D366] text-white" : "border-[#25D366] bg-white"
          }`}
        >
          {checked && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
        <span className="text-sm font-medium text-[#111B21]">
          {staff
            ? "Patient agrees to receive messages from Ur's Toothfully on WhatsApp"
            : "Yes, send me updates from Ur's Toothfully on WhatsApp"}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#667781]">
        {staff ? "They can" : "You can"} reply <strong>STOP</strong> anytime to unsubscribe.
      </p>
    </label>
  )
}
