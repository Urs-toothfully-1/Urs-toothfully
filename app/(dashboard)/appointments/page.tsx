import { Metadata } from "next"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { appointmentService } from "@/server/services/appointment.service"
import { userRepository } from "@/server/repositories/user.repository"
import { NewAppointmentDialog } from "@/components/appointments/NewAppointmentDialog"
import { AppointmentCard, type AppointmentView } from "@/components/appointments/AppointmentCard"
import { AutoRefresh } from "@/components/shared/AutoRefresh"
import { BRAND_COLORS } from "@/lib/constants"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Appointments" }
export const dynamic = "force-dynamic"

function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return toDayString(d)
}

interface Props {
  searchParams: Promise<{ date?: string }>
}

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await requireSession()
  const { date: rawDate } = await searchParams

  const today = toDayString(new Date())
  const day = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today
  const dayDate = new Date(`${day}T12:00:00`)

  const isDoctor = session.role === "DOCTOR"
  const canManage = true // all roles can act on what they can see

  const [appointments, doctors] = await Promise.all([
    appointmentService.listForDay({
      date: dayDate,
      // Admin sees all branches; reception sees own branch; doctors see their own appointments everywhere
      ...(session.role === "RECEPTIONIST" ? { branchId: session.branchId } : {}),
      ...(isDoctor ? { doctorId: session.userId } : {}),
    }),
    isDoctor ? Promise.resolve([]) : userRepository.findAllActiveDoctors(),
  ])

  const views: AppointmentView[] = appointments.map((a) => ({
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    durationMins: a.durationMins,
    status: a.status,
    reason: a.reason,
    patient: {
      id: a.patient.id,
      patientId: a.patient.patientId,
      fullName: a.patient.fullName,
      mobile: a.patient.mobile,
    },
    doctor: { id: a.doctor.id, name: a.doctor.name },
    branch: { id: a.branch.id, name: a.branch.name },
  }))

  const scheduled = views.filter((v) => v.status === "SCHEDULED")
  const done = views.filter((v) => v.status !== "SCHEDULED")

  const heading = dayDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const navBtn =
    "flex items-center justify-center h-9 w-9 rounded-lg border border-[#E0E3E5] bg-white hover:bg-gray-50"

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <AutoRefresh />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
            Appointments
          </h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {isDoctor ? "Your bookings" : session.role === "ADMIN" ? "All branches" : "Your branch"} · {heading}
          </p>
        </div>
        {!isDoctor && <NewAppointmentDialog doctors={doctors.map((d) => ({ id: d.id, name: d.name }))} />}
      </div>

      {/* Day navigation */}
      <div className="flex items-center gap-2">
        <Link href={`/appointments?date=${shiftDay(day, -1)}`} className={navBtn} aria-label="Previous day">
          <ChevronLeft className="h-4 w-4" style={{ color: BRAND_COLORS.bodyText }} />
        </Link>
        <Link
          href="/appointments"
          className="px-3 h-9 flex items-center rounded-lg border text-sm font-medium"
          style={
            day === today
              ? { backgroundColor: BRAND_COLORS.sidebarActiveBg, borderColor: BRAND_COLORS.primaryTeal, color: BRAND_COLORS.primaryTeal }
              : { backgroundColor: "white", borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }
          }
        >
          Today
        </Link>
        <Link href={`/appointments?date=${shiftDay(day, 1)}`} className={navBtn} aria-label="Next day">
          <ChevronRight className="h-4 w-4" style={{ color: BRAND_COLORS.bodyText }} />
        </Link>
        <span className="text-sm ml-2" style={{ color: BRAND_COLORS.borderDivider }}>
          {views.length} appointment{views.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {views.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[#E0E3E5] bg-white">
          <CalendarDays className="h-12 w-12 mx-auto mb-3" style={{ color: "#E0E3E5" }} />
          <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>No appointments on this day</p>
          {!isDoctor && (
            <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
              Use “New Appointment” to book one.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {scheduled.map((a) => (
            <AppointmentCard key={a.id} appointment={a} canManage={canManage} />
          ))}
          {done.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide pt-3" style={{ color: BRAND_COLORS.sidebarMuted }}>
                Finished
              </p>
              {done.map((a) => (
                <AppointmentCard key={a.id} appointment={a} canManage={false} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
