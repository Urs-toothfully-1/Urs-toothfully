/**
 * Runs once at server startup (Next.js instrumentation hook).
 *
 * The clinic operates entirely in IST, and every "today" computation in the
 * app (queue day-filter, dashboards, reports, appointments) uses local-time
 * Date methods. Vercel functions run in UTC and the TZ env var is reserved
 * there, so pin the process timezone here instead. On POSIX runtimes Node
 * picks this up for all subsequent Date operations.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.TZ) {
    process.env.TZ = process.env.APP_TIMEZONE ?? "Asia/Kolkata"
  }
}
