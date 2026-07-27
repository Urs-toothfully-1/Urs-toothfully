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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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

  const time = new Date(a.scheduledAt)
  const style = STATUS_STYLE[a.status]

  const [reschedOpen, setReschedOpen] = useState(false)
  // Prefill from the IST wall-clock, not the raw UTC slice of the ISO string.
  const [rDate, setRDate] = useState(istDayKey(time))
  const [rTime, setRTime] = useState(istTimeValue(time))

  function update(status: AppointmentStatus, reason?: string) {
    startTransition(async () => {
      const result = await updateAppointmentStatusAction(a.id, status, reason)
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
    <Card className="border-[#E0E3E5]">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {/* Time block */}
          <div className="text-center flex-shrink-0 w-16">
            <p className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
              {fmtIstTime(time)}
            </p>
            <p className="text-[11px] flex items-center justify-center gap-0.5" style={{ color: BRAND_COLORS.sidebarMuted }}>
              <Clock className="h-3 w-3" /> {a.durationMins}m
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/patients/${a.patient.id}`}
                className="font-semibold text-sm hover:underline truncate"
                style={{ color: BRAND_COLORS.bodyText }}
              >
                {a.patient.fullName}
              </Link>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ backgroundColor: style.bg, color: style.color }}
              >
                {style.label}
              </span>
            </div>
            <p className="text-xs mt-0.5 truncate flex items-center gap-1.5" style={{ color: BRAND_COLORS.sidebarMuted }}>
              <span>{a.patient.patientId} · 📱 {a.patient.mobile} · {a.doctor.name} ·</span>
              <BranchBadge name={a.branch.name} />
            </p>
            {a.reason && (
              <p className="text-xs mt-0.5 truncate" style={{ color: BRAND_COLORS.bodyText }}>
                {a.reason}
              </p>
            )}
          </div>
        </div>

        {canManage && a.status === "SCHEDULED" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => update("COMPLETED")}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => update("NO_SHOW")}
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <UserX className="h-3.5 w-3.5 mr-1" /> No Show
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setReschedOpen(true)}
              className="text-[#005E97] border-[#93C5FD] hover:bg-blue-50"
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1" /> Reschedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => update("CANCELLED", cancelReason.trim() || undefined)}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reschedOpen} onOpenChange={setReschedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>{a.patient.fullName} · {a.doctor.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={rDate} min={istTodayStr()} onChange={(e) => setRDate(e.target.value)} />
            <Input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedOpen(false)} disabled={isPending}>Keep</Button>
            <Button disabled={isPending || !rDate || !rTime} onClick={reschedule} style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
