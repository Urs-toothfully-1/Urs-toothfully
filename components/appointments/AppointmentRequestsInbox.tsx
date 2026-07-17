"use client"

import { useState, useTransition } from "react"
import { confirmAppointmentRequestAction, declineAppointmentRequestAction } from "@/actions/appointments"
import { BranchBadge } from "@/components/shared/BranchBadge"
import { BRAND_COLORS } from "@/lib/constants"
import { Inbox, Phone, Calendar, Check, X, Loader2, ChevronDown } from "lucide-react"
import { toast } from "sonner"

export interface RequestView {
  id: string
  fullName: string
  mobile: string
  problem: string | null
  preferredDate: string // yyyy-mm-dd
  createdAt: string
  branch: { id: string; name: string }
}

interface Props {
  requests: RequestView[]
  doctors: { id: string; name: string }[]
}

function ConfirmRow({ req, doctors }: { req: RequestView; doctors: Props["doctors"] }) {
  const [open, setOpen] = useState(false)
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "")
  const [date, setDate] = useState(req.preferredDate)
  const [time, setTime] = useState("10:30")
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()

  function confirm() {
    if (!doctorId) return toast.error("Please pick a doctor")
    start(async () => {
      const res = await confirmAppointmentRequestAction(req.id, doctorId, date, time)
      if (res.success) toast.success(`Appointment confirmed for ${req.fullName}`)
      else toast.error(res.error ?? "Failed to confirm")
    })
  }

  function decline() {
    start(async () => {
      const res = await declineAppointmentRequestAction(req.id, reason.trim() || undefined)
      if (res.success) toast.success(`Declined — please call ${req.fullName} on ${req.mobile}`)
      else toast.error(res.error ?? "Failed to decline")
    })
  }

  const prettyDate = new Date(`${req.preferredDate}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  })

  return (
    <div className="rounded-xl border border-[#E0E3E5] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm" style={{ color: BRAND_COLORS.bodyText }}>{req.fullName}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{req.mobile}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Prefers {prettyDate}</span>
            <BranchBadge name={req.branch.name} />
          </div>
          {req.problem && <p className="text-xs mt-1.5" style={{ color: BRAND_COLORS.secondaryText }}>“{req.problem}”</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
        >
          Confirm <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} disabled={pending}
            className="h-9 rounded-lg border border-[#E0E3E5] bg-white px-2 text-sm">
            <option value="">Select doctor…</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={pending}
            className="h-9 rounded-lg border border-[#E0E3E5] bg-white px-2 text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={pending}
            className="h-9 rounded-lg border border-[#E0E3E5] bg-white px-2 text-sm" />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            maxLength={500}
            placeholder="Reason (only needed if declining)"
            className="sm:col-span-3 h-9 rounded-lg border border-[#E0E3E5] bg-white px-2 text-sm"
          />
          <p className="sm:col-span-3 text-[11px] -mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
            Declining does not notify the patient — call {req.mobile} to let them know.
          </p>
          <div className="sm:col-span-3 flex items-center gap-2 justify-end">
            <button type="button" onClick={decline} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600" style={{ borderColor: "#FECACA" }}>
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button type="button" onClick={confirm} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirm & Notify
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AppointmentRequestsInbox({ requests, doctors }: Props) {
  if (requests.length === 0) return null
  return (
    <div className="rounded-xl border-2 p-4" style={{ borderColor: BRAND_COLORS.primaryTealLight, backgroundColor: "#F7FBFF" }}>
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
        <h2 className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Online appointment requests</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
          {requests.length}
        </span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => <ConfirmRow key={r.id} req={r} doctors={doctors} />)}
      </div>
    </div>
  )
}
