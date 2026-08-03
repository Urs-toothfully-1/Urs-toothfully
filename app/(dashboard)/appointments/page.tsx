import { Metadata } from "next"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { appointmentService } from "@/server/services/appointment.service"
import { appointmentRequestService } from "@/server/services/appointment-request.service"
import { userRepository } from "@/server/repositories/user.repository"
import { NewAppointmentDialog } from "@/components/appointments/NewAppointmentDialog"
import { AppointmentCard, type AppointmentView } from "@/components/appointments/AppointmentCard"
import { AppointmentRequestsInbox } from "@/components/appointments/AppointmentRequestsInbox"
import { AutoRefresh } from "@/components/shared/AutoRefresh"
import { BRAND_COLORS } from "@/lib/constants"
import { istTodayStr, istDayRange, IST_TZ } from "@/lib/ist"
import { CalendarDays, ChevronLeft, ChevronRight, Building2, Globe } from "lucide-react"

export const metadata: Metadata = { title: "Appointments" }
export const dynamic = "force-dynamic"

function pad(n: number) { return String(n).padStart(2, "0") }
function toDayString(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface Props {
  searchParams: Promise<{ date?: string; month?: string; scope?: string }>
}

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await requireSession()
  const { date: rawDate, month: rawMonth, scope } = await searchParams

  const todayStr = istTodayStr()
  const day = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayStr
  const dayDate = new Date(`${day}T12:00:00`)

  // Month shown in the calendar (defaults to the selected day's month)
  const monthBase = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
    ? new Date(`${rawMonth}-01T12:00:00`)
    : new Date(dayDate.getFullYear(), dayDate.getMonth(), 1, 12)
  const monthStr = `${monthBase.getFullYear()}-${pad(monthBase.getMonth() + 1)}`
  const daysInMonthCount = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate()
  // IST-day bounds so a booking's day matches the calendar cell it lands in.
  const monthStart = istDayRange(`${monthStr}-01`).start
  const monthEnd = istDayRange(`${monthStr}-${pad(daysInMonthCount)}`).end
  const prevMonth = `${new Date(monthBase.getFullYear(), monthBase.getMonth() - 1, 1).getFullYear()}-${pad(new Date(monthBase.getFullYear(), monthBase.getMonth() - 1, 1).getMonth() + 1)}`
  const nextMonth = `${new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 1).getFullYear()}-${pad(new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 1).getMonth() + 1)}`

  const isDoctor = session.role === "DOCTOR"
  const isReception = session.role === "RECEPTIONIST"
  // Reception sees own branch by default; "All Branches" removes the filter.
  const allBranches = !isReception || scope === "all"
  const branchFilter = isReception && !allBranches ? session.branchId : undefined
  const doctorFilter = isDoctor ? session.userId : undefined

  const [appointments, counts, doctors, pendingRequests, overdue] = await Promise.all([
    appointmentService.listForDay({ date: dayDate, branchId: branchFilter, doctorId: doctorFilter }),
    appointmentService.countsForRange({ start: monthStart, end: monthEnd, branchId: branchFilter, doctorId: doctorFilter }),
    isDoctor ? Promise.resolve([]) : userRepository.findAllActiveDoctors(),
    isDoctor ? Promise.resolve([]) : appointmentRequestService.listPending(branchFilter),
    appointmentService.listOverdue({ branchId: branchFilter, doctorId: doctorFilter }),
  ])

  const requestViews = pendingRequests.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    mobile: r.mobile,
    problem: r.problem,
    preferredDate: toDayString(r.preferredDate),
    createdAt: r.createdAt.toISOString(),
    branch: { id: r.branch.id, name: r.branch.name },
  }))

  const toView = (a: (typeof appointments)[number]): AppointmentView => ({
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    durationMins: a.durationMins,
    status: a.status,
    reason: a.reason,
    patient: { id: a.patient.id, patientId: a.patient.patientId, fullName: a.patient.fullName, mobile: a.patient.mobile },
    doctor: { id: a.doctor.id, name: a.doctor.name },
    branch: { id: a.branch.id, name: a.branch.name },
  })
  const views: AppointmentView[] = appointments.map(toView)
  // Shown on every day, not just their own — otherwise nobody finds them again.
  const overdueViews: AppointmentView[] = overdue.map(toView)
  const scheduled = views.filter((v) => v.status === "SCHEDULED")
  const done = views.filter((v) => v.status !== "SCHEDULED")

  // Build the month grid (Sunday-first), padded to full weeks. Weekday of the
  // 1st is read from a noon-UTC date so it never shifts with the host timezone.
  const leading = new Date(`${monthStr}-01T12:00:00Z`).getUTCDay()
  const daysInMonth = daysInMonthCount
  const cells: (string | null)[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${monthStr}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)

  const scopeQs = allBranches && isReception ? "&scope=all" : ""
  const cellHref = (d: string) => `/appointments?date=${d}&month=${monthStr}${scopeQs}`
  const heading = dayDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST_TZ })

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <AutoRefresh />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Appointments</h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {isDoctor ? "Your bookings across all branches" : allBranches ? "All branches" : "Your branch"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReception && (
            <Link
              href={allBranches ? `/appointments?date=${day}&month=${monthStr}` : `/appointments?date=${day}&month=${monthStr}&scope=all`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border"
              style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
            >
              {allBranches ? <Building2 className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> : <Globe className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />}
              {allBranches ? "My Branch" : "All Branches"}
            </Link>
          )}
          {!isDoctor && <NewAppointmentDialog doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />}
        </div>
      </div>

      {!isDoctor && (
        <AppointmentRequestsInbox requests={requestViews} doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-5">
        {/* Calendar */}
        <div className="rounded-xl border border-[#E0E3E5] bg-white p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <Link href={`/appointments?date=${day}&month=${prevMonth}${scopeQs}`} aria-label="Previous month"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-[#E0E3E5] hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" style={{ color: BRAND_COLORS.bodyText }} />
            </Link>
            <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
              {monthBase.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </p>
            <Link href={`/appointments?date=${day}&month=${nextMonth}${scopeQs}`} aria-label="Next month"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-[#E0E3E5] hover:bg-gray-50">
              <ChevronRight className="h-4 w-4" style={{ color: BRAND_COLORS.bodyText }} />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-[10px] font-semibold uppercase" style={{ color: BRAND_COLORS.sidebarMuted }}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const n = counts[d] ?? 0
              const isSel = d === day
              const isToday = d === todayStr
              return (
                <Link key={d} href={cellHref(d)}
                  className="relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor: isSel ? BRAND_COLORS.primaryTeal : n > 0 ? `${BRAND_COLORS.primaryTeal}12` : "transparent",
                    color: isSel ? "white" : BRAND_COLORS.bodyText,
                    border: isToday && !isSel ? `1px solid ${BRAND_COLORS.primaryTeal}` : "1px solid transparent",
                    fontWeight: isSel || isToday ? 700 : 400,
                  }}
                >
                  {Number(d.slice(-2))}
                  {n > 0 && (
                    <span className="text-[9px] leading-none mt-0.5 font-semibold"
                      style={{ color: isSel ? "white" : BRAND_COLORS.primaryTeal }}>
                      {n}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <Link href={`/appointments${scopeQs ? `?scope=all` : ""}`} className="text-xs font-medium" style={{ color: BRAND_COLORS.primaryTeal }}>
              Jump to today
            </Link>
            <span className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>number = booked</span>
          </div>
        </div>

        {/* Day list */}
        <div className="space-y-3">
          {overdueViews.length > 0 && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#FCD34D", backgroundColor: "#FFFBEB" }}>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" style={{ color: "#B45309" }} />
                <h2 className="text-sm font-semibold" style={{ color: "#92400E" }}>
                  Still open from earlier days
                </h2>
                <span className="text-xs ml-auto" style={{ color: "#B45309" }}>
                  {overdueViews.length} to close
                </span>
              </div>
              <p className="text-xs" style={{ color: "#B45309" }}>
                Mark each one Done, No Show or Cancelled — they stay here until you do.
              </p>
              {overdueViews.map((a) => (
                <div key={a.id}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "#B45309" }}>
                    {new Date(a.scheduledAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST_TZ })}
                  </p>
                  <AppointmentCard appointment={a} canManage={true} />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            <h2 className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{heading}</h2>
            <span className="text-xs ml-auto" style={{ color: BRAND_COLORS.borderDivider }}>
              {views.length} appointment{views.length !== 1 ? "s" : ""}
            </span>
          </div>

          {views.length === 0 ? (
            <div className="text-center py-14 rounded-xl border border-[#E0E3E5] bg-white">
              <CalendarDays className="h-10 w-10 mx-auto mb-3" style={{ color: "#E0E3E5" }} />
              <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>No appointments</p>
              {!isDoctor && <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>Use &ldquo;New Appointment&rdquo; to book one.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {scheduled.map((a) => <AppointmentCard key={a.id} appointment={a} canManage={true} />)}
              {done.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide pt-3" style={{ color: BRAND_COLORS.sidebarMuted }}>Finished</p>
                  {done.map((a) => <AppointmentCard key={a.id} appointment={a} canManage={false} />)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
