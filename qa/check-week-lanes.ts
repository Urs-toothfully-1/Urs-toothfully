/**
 * Overlap lane assignment for the week calendar.
 *
 * The whole point of the grid over Dentee's is that two patients booked in the
 * same slot render side by side instead of on top of each other. That is pure
 * arithmetic, and it silently degrades to "everything in lane 0" if the
 * comparison flips, so it gets checked directly.
 */
import { assignLanes } from "@/components/appointments/WeekCalendar"

let failures = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`)
  if (!ok) failures++
}

const at = (hhmm: string, mins: number, id = hhmm) =>
  ({ id, scheduledAt: `2026-08-26T${hhmm}:00.000+05:30`, durationMins: mins }) as never

const lanes = (items: unknown[]) => assignLanes(items as never).map((l) => l.lane)

check(JSON.stringify(lanes([at("10:00", 30), at("11:00", 30)])) === "[0,0]",
  "back-to-back bookings share one lane")

check(JSON.stringify(lanes([at("10:00", 60), at("10:30", 30)])) === "[0,1]",
  "an overlapping booking moves to its own lane")

check(JSON.stringify(lanes([at("10:00", 60), at("10:15", 60), at("10:30", 60)])) === "[0,1,2]",
  "three-deep overlap opens three lanes")

check(JSON.stringify(lanes([at("10:00", 30), at("10:00", 30)])) === "[0,1]",
  "identical slots never stack on each other")

check(JSON.stringify(lanes([at("10:00", 30), at("10:15", 30), at("11:00", 30)])) === "[0,1,0]",
  "a lane is reused once its booking has ended")

console.log(failures === 0 ? "\nall week-calendar lane checks passed" : `\n${failures} FAILED`)
process.exitCode = failures ? 1 : 0
