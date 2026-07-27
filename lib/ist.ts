/**
 * Everything appointment-related runs on Asia/Kolkata (IST) wall-clock time.
 *
 * The bug this fixes: `new Date("2026-07-20T10:30")` parses as the SERVER's
 * local zone. On Vercel that's UTC, so a 10:30 booking was stored as 10:30Z and
 * then rendered in the browser (IST) as 16:00. Parse and format explicitly in
 * IST and the wall-clock the user typed is the wall-clock everyone sees.
 *
 * IST is a fixed +05:30 offset with no daylight saving, so a literal offset is
 * correct and far simpler than a tz library.
 */

export const IST_TZ = "Asia/Kolkata"
const IST_OFFSET = "+05:30"

/** UTC instant for an IST wall-clock date + time from <input type="date"/"time">. */
export function istInstant(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00${IST_OFFSET}`)
}

/** {start,end} UTC instants spanning the whole IST calendar day of `dateStr`. */
export function istDayRange(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00.000${IST_OFFSET}`),
    end: new Date(`${dateStr}T23:59:59.999${IST_OFFSET}`),
  }
}

/** YYYY-MM-DD of the IST calendar day containing `d` (en-CA gives ISO order). */
export function istDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** Today's date string (YYYY-MM-DD) in IST — for min= and default day. */
export function istTodayStr(): string {
  return istDayKey(new Date())
}

/** HH:mm (24h) IST wall-clock of `d` — for prefilling <input type="time">. */
export function istTimeValue(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

export function fmtIstTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST_TZ })
}

export function fmtIstDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: IST_TZ })
}

export function fmtIstDateTime(d: Date): string {
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST_TZ })
}
