"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateAppointmentStatusAction, rescheduleAppointmentAction } from "@/actions/appointments"
import { BRAND_COLORS } from "@/lib/constants"
import { BranchBadge } from "@/components/shared/BranchBadge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CalendarClock, CheckCircle2, Clock, Loader2, UserX, XCircle } from "lucide-react"
import type { AppointmentStatus } from "@prisma/client"
import { fmtIstTime, fmtIstDateTime, istDayKey, istTimeValue, istTodayStr } from "@/lib/ist"

const STATUS_STYLE: Record<AppointmentStatus, { label: string; bg: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", bg: "#DBEAFE", color: "#1E40AF" },
  COMPLETED: { label: "Completed", bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Cancelled", bg: "#FEE2E2", color: "#991B1B" },
  NO_SHOW: { label: "No Show", bg: "#FEF3C7", color: "#92400E" },
}

export interface AppointmentView {
  id: string
  scheduledAt: string // ISO
  durationMins: number
  status: AppointmentStatus
  reason: string | null
  patient: { id: string; patientId: string; fullName: string; mobile: string }
  doctor: { id: string; name: string }
  branch: { id: string; name: string }
  /** Event offers not yet given, e.g. "Black Friday: FREE teeth cleaning". */
  offers?: string[]
}

interface Props {
  appointment: AppointmentView
  /** actions are hidden for read-only viewers (doctors see their own with actions) */
  canManage: boolean
}

export function AppointmentCard({ appointment: a, canManage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [notifyPatient, setNotifyPatient] = useState(true)

  const time = new Date(a.scheduledAt)
  const style = STATUS_STYLE[a.status]

  const [reschedOpen, setReschedOpen] = useState(false)
  // Prefill from the IST wall-clock, not the raw UTC slice of the ISO string.
  const [rDate, setRDate] = useState(istDayKey(time))
  const [rTime, setRTime] = useState(istTimeValue(time))

  function update(status: AppointmentStatus, reason?: string, notify = true) {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(a.id, status, reason, notify)
      if (result.success) {
        toast.success(`Appointment ${STATUS_STYLE[status].label.toLowerCase()}`)
        setCancelOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to update appointment")
      }
    })
  }

  function reschedule() {
    startTransition(async () => {
      const result = await rescheduleAppointmentAction(a.id, rDate, rTime)
      if (result.success) {
        toast.success("Appointment rescheduled")
        setReschedOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to reschedule")
      }
    })
  }

  return (
    <Card className="border-[#E0E3E5]" data-testid="appointment-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {/* Time block */}
          <div className="w-16 flex-shrink-0 text-center">
            <p className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
              {fmtIstTime(time)}
            </p>
            <p
              className="flex items-center justify-center gap-0.5 text-[11px]"
              style={{ color: BRAND_COLORS.sidebarMuted }}
            >
              <Clock className="h-3 w-3" /> {a.durationMins}m
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/patients/${a.patient.id}`}
                className="truncate text-sm font-semibold hover:underline"
                style={{ color: BRAND_COLORS.bodyText }}
              >
                {a.patient.fullName}
              </Link>
              <span
                className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: style.bg, color: style.color }}
              >
                {style.label}
              </span>
              {a.offers?.map((o) => (
                <span
                  key={o}
                  className="flex-shrink-0 rounded-full border border-[#E2B04A] bg-[#FDF3DC] px-2 py-0.5 text-[11px] font-semibold text-[#7A4E0B]"
                  title="Event offer to give at this visit — mark it given on the patient's profile"
                >
                  🎁 {o}
                </span>
              ))}
            </div>
            <p
              className="mt-0.5 flex items-center gap-1.5 truncate text-xs"
              style={{ color: BRAND_COLORS.sidebarMuted }}
            >
              <span>
                {a.patient.patientId} · 📱 {a.patient.mobile} · {a.doctor.name} ·
              </span>
              <BranchBadge name={a.branch.name} />
            </p>
            {a.reason && (
              <p className="mt-0.5 truncate text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                {a.reason}
              </p>
            )}
          </div>
        </div>

        {canManage && a.status === "SCHEDULED" && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => update("COMPLETED")}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => update("NO_SHOW")}
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <UserX className="mr-1 h-3.5 w-3.5" /> No Show
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setReschedOpen(true)}
              className="border-[#93C5FD] text-[#005E97] hover:bg-blue-50"
            >
              <CalendarClock className="mr-1 h-3.5 w-3.5" /> Reschedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              {a.patient.fullName} · {fmtIstDateTime(time)}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            maxLength={300}
          />
          <label
            className="flex cursor-pointer items-start gap-2 text-sm"
            style={{ color: BRAND_COLORS.bodyText }}
          >
            <input
              type="checkbox"
              checked={notifyPatient}
              onChange={(e) => setNotifyPatient(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Send cancellation message to the patient on WhatsApp
              <span className="block text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
                Untick for a booking made by mistake or a test.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => update("CANCELLED", cancelReason.trim() || undefined, notifyPatient)}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reschedOpen} onOpenChange={setReschedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              {a.patient.fullName} · {a.doctor.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={rDate}
              min={istTodayStr()}
              onChange={(e) => setRDate(e.target.value)}
            />
            <Input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedOpen(false)} disabled={isPending}>
              Keep
            </Button>
            <Button
              disabled={isPending || !rDate || !rTime}
              onClick={reschedule}
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
