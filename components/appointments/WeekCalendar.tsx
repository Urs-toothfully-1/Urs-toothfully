import Link from "next/link"
import { BRAND_COLORS } from "@/lib/constants"
import { IST_TZ } from "@/lib/ist"
import type { AppointmentView } from "@/components/appointments/AppointmentCard"

/**
 * Week time-grid. One column per day, appointments positioned by start time and
 * duration, coloured by doctor.
 *
 * Overlapping bookings are laid out side by side rather than stacked on top of
 * one another: with two patients in the same slot the stacked version clips both
 * names, which is exactly when you most need to read them.
 */

/** Bookings are taken on the quarter hour, so the grid rules on the quarter hour. */
const SLOT_MINS = 15
/** Shown even when empty, so the grid does not collapse on a quiet day. */
const DEFAULT_START_HOUR = 9
const DEFAULT_END_HOUR = 21
/** Height of one 15-minute slot. An hour is 4 of these. */
const ROW_PX = 15
/** How far each overlapping booking is nudged right, so the one beneath stays visible. */
const LANE_OFFSET_PX = 14

/**
 * Solid per-doctor fills, assigned in a stable order so colours never shuffle.
 * Saturated rather than tinted: at a glance across a full week the eye picks out
 * "whose column is this" from the fill, long before it can read any name.
 * `text` is paired to each fill by hand for contrast.
 */
const DOCTOR_COLORS = [
  { bg: "#86E29B", text: "#0B3D1E" }, // green
  { bg: "#5B2C87", text: "#FFFFFF" }, // deep purple
  { bg: "#D926C4", text: "#FFFFFF" }, // magenta
  { bg: "#B8C6DC", text: "#14263D" }, // slate
  { bg: "#F5B942", text: "#3D2A05" }, // amber
  { bg: "#0D9488", text: "#FFFFFF" }, // teal
]

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
})

/** Minutes past midnight IST, read through Intl so the host timezone is irrelevant. */
function istMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return h * 60 + m
}

const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`

/**
 * Give each appointment a horizontal lane so overlapping ones sit beside each
 * other. Greedy: reuse the first lane whose previous booking has already ended.
 */
export function assignLanes(items: AppointmentView[]) {
  const laneEnds: number[] = []
  return items.map((a) => {
    const start = istMinutes(a.scheduledAt)
    const end = start + a.durationMins
    let lane = laneEnds.findIndex((e) => e <= start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(end)
    } else {
      laneEnds[lane] = end
    }
    return { a, start, end, lane }
  })
}

type Props = {
  /** Sunday-first list of yyyy-mm-dd keys. */
  days: string[]
  appointments: AppointmentView[]
  /** Link target for a day column header. */
  dayHref: (day: string) => string
}

export function WeekCalendar({ days, appointments, dayHref }: Props) {
  // Doctors in first-seen order, so the legend and the blocks always agree.
  const doctorIds: string[] = []
  for (const a of appointments) if (!doctorIds.includes(a.doctor.id)) doctorIds.push(a.doctor.id)
  const colorFor = (doctorId: string) =>
    DOCTOR_COLORS[Math.max(0, doctorIds.indexOf(doctorId)) % DOCTOR_COLORS.length]

  // Widen the window if anything falls outside clinic hours, so an early or late
  // booking is never silently cropped out of the grid.
  let startHour = DEFAULT_START_HOUR
  let endHour = DEFAULT_END_HOUR
  for (const a of appointments) {
    const s = istMinutes(a.scheduledAt)
    startHour = Math.min(startHour, Math.floor(s / 60))
    endHour = Math.max(endHour, Math.ceil((s + a.durationMins) / 60))
  }
  const gridStart = startHour * 60
  const hours = endHour - startHour
  const gridHeight = ((hours * 60) / SLOT_MINS) * ROW_PX

  const byDay = new Map<string, AppointmentView[]>()
  for (const a of appointments) {
    const k = dayKeyFmt.format(new Date(a.scheduledAt))
    const list = byDay.get(k)
    if (list) list.push(a)
    else byDay.set(k, [a])
  }

  const todayKey = dayKeyFmt.format(new Date())

  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E0E3E5" }}>
      {doctorIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b" style={{ borderColor: "#F2F4F6" }}>
          {doctorIds.map((id) => {
            const c = colorFor(id)
            const name = appointments.find((a) => a.doctor.id === id)?.doctor.name ?? ""
            return (
              <span key={id} className="flex items-center gap-1.5 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.bg }} />
                {name}
              </span>
            )
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          {/* Day headers */}
          <div className="grid border-b" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", borderColor: "#F2F4F6" }}>
            <div />
            {days.map((d) => {
              const dt = new Date(`${d}T12:00:00Z`)
              const isToday = d === todayKey
              return (
                <Link
                  key={d}
                  href={dayHref(d)}
                  className="px-2 py-2 text-center border-l hover:bg-[#F8FAFB]"
                  style={{ borderColor: "#F2F4F6" }}
                >
                  <div className="text-[11px] uppercase tracking-wide" style={{ color: BRAND_COLORS.borderDivider }}>
                    {dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}
                  </div>
                  <div
                    className="text-sm font-semibold mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5"
                    style={
                      isToday
                        ? { backgroundColor: BRAND_COLORS.primaryTeal, color: "white" }
                        : { color: BRAND_COLORS.bodyText }
                    }
                  >
                    {dt.getUTCDate()}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="grid relative" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", height: gridHeight }}>
            <div className="relative">
              {Array.from({ length: hours }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums"
                  style={{ top: i * 4 * ROW_PX, color: BRAND_COLORS.borderDivider }}
                >
                  {hhmm((startHour + i) * 60)}
                </div>
              ))}
            </div>

            {days.map((d) => {
              const laid = assignLanes(byDay.get(d) ?? [])
              return (
                <div key={d} className="relative border-l" style={{ borderColor: "#F2F4F6" }}>
                  {/* A line every quarter hour; the hour itself darker. */}
                  {Array.from({ length: hours * 4 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-0 border-t"
                      style={{ top: i * ROW_PX, borderColor: i % 4 === 0 ? "#E6EAEE" : "#F7F9FA" }}
                    />
                  ))}

                  {laid.map(({ a, start, end, lane }) => {
                    const c = colorFor(a.doctor.id)
                    const cancelled = a.status === "CANCELLED"
                    const noShow = a.status === "NO_SHOW"
                    const done = a.status === "COMPLETED"
                    return (
                      <Link
                        key={a.id}
                        href={`/patients/${a.patient.id}`}
                        title={`${hhmm(start)}-${hhmm(end)} · ${a.patient.fullName} · ${a.doctor.name}${a.reason ? ` · ${a.reason}` : ""}`}
                        className="absolute rounded-md px-1.5 py-0.5 overflow-hidden hover:z-10 hover:shadow-md"
                        style={{
                          top: ((start - gridStart) / SLOT_MINS) * ROW_PX,
                          height: Math.max(ROW_PX * 2 - 2, (a.durationMins / SLOT_MINS) * ROW_PX - 2),
                          left: lane * LANE_OFFSET_PX + 2,
                          width: `calc(100% - ${lane * LANE_OFFSET_PX + 4}px)`,
                          zIndex: lane + 1,
                          backgroundColor: cancelled ? "#E5E7EB" : c.bg,
                          color: cancelled ? "#6B7280" : c.text,
                          boxShadow: noShow ? "inset 0 0 0 2px #DC2626" : undefined,
                          opacity: done ? 0.75 : 1,
                          textDecoration: cancelled ? "line-through" : undefined,
                        }}
                      >
                        <div className="text-[11px] font-semibold leading-tight truncate">{a.patient.fullName}</div>
                        {/* A 30-minute block is only tall enough for one line; the
                            rest stays in the hover title rather than spilling out. */}
                        {a.durationMins >= 45 && (
                          <div className="text-[10px] leading-tight truncate opacity-90">
                            {hhmm(start)} · {a.doctor.name}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
