/**
 * In-app scheduler for Railway (an always-on server), replacing vercel.json's
 * crons. Started from instrumentation.ts only when RAILWAY_ENVIRONMENT is set.
 * Calls the app's own cron endpoints over localhost with CRON_SECRET, so the
 * jobs run exactly the code Vercel Cron ran.
 *
 *  - 21:00 IST  /api/cron/daily   reminders, automations, digest, queue drain
 *  - 01:30 IST  /api/cron/backup  emailed database backup
 *  - every 2 min /api/cron/queue  sends queued + retries failed WhatsApp
 *
 * ponytail: last-run is in memory and assumes ONE replica. A restart inside a
 * job's 10-minute window can run it twice (reminders/automations dedupe; the
 * admin digest could repeat). Keep numReplicas = 1, or move last-run to the DB
 * if you ever scale out.
 */

const JOBS = [
  { name: "daily", at: 21 * 60, path: "/api/cron/daily" },
  { name: "backup", at: 1 * 60 + 30, path: "/api/cron/backup" },
] as const
const WINDOW_MIN = 10 // catch up if the server was busy/restarting at the exact minute
const QUEUE_EVERY_MIN = 2

/** IST calendar day ("YYYY-MM-DD") and minute-of-day for an instant. */
export function istClock(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((x) => [x.type, x.value])
  )
  return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) }
}

/** Jobs due now that haven't run today. Pure — see the self-check below. */
export function dueJobs(now: Date, lastRun: Map<string, string>) {
  const { day, minute } = istClock(now)
  return JOBS.filter((j) => minute >= j.at && minute < j.at + WINDOW_MIN && lastRun.get(j.name) !== day)
}

const g = globalThis as { __toothfullyScheduler?: boolean }

export function startScheduler() {
  const secret = process.env.CRON_SECRET || process.env.WHATSAPP_CRON_SECRET
  if (!secret) return console.warn("[scheduler] CRON_SECRET not set — scheduled jobs are OFF")
  if (g.__toothfullyScheduler) return
  g.__toothfullyScheduler = true

  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`
  const call = (path: string, method: "GET" | "POST", log: boolean) =>
    fetch(base + path, { method, headers: { authorization: `Bearer ${secret}` } })
      .then(async (r) => {
        if (log || !r.ok) console.log(`[scheduler] ${method} ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`)
      })
      .catch((e) => console.error(`[scheduler] ${path} failed:`, e instanceof Error ? e.message : e))

  const lastRun = new Map<string, string>()
  const tick = () => {
    const now = new Date()
    for (const j of dueJobs(now, lastRun)) {
      lastRun.set(j.name, istClock(now).day)
      void call(j.path, "GET", true)
    }
    if (istClock(now).minute % QUEUE_EVERY_MIN === 0) void call("/api/cron/queue", "GET", false)
  }
  // First tick after the server is listening; then once a minute.
  setTimeout(tick, 15_000)
  setInterval(tick, 60_000).unref()
  console.log("[scheduler] started: daily 21:00 IST, backup 01:30 IST, WhatsApp queue every 2 min")
}

// Self-check: npx tsx lib/scheduler.ts
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  const at = (iso: string) => new Date(iso) // IST = UTC+5:30
  const runs = new Map<string, string>()
  ok(istClock(at("2026-11-23T15:30:00Z")).minute === 21 * 60, "15:30 UTC is 21:00 IST")
  ok(dueJobs(at("2026-11-23T15:29:00Z"), runs).length === 0, "nothing at 20:59")
  ok(dueJobs(at("2026-11-23T15:30:00Z"), runs).map((j) => j.name).join() === "daily", "daily at 21:00")
  ok(dueJobs(at("2026-11-23T15:39:00Z"), runs).length === 1, "catch-up within 10 min")
  ok(dueJobs(at("2026-11-23T15:40:00Z"), runs).length === 0, "window closed at 21:10")
  runs.set("daily", "2026-11-23")
  ok(dueJobs(at("2026-11-23T15:31:00Z"), runs).length === 0, "not twice the same day")
  ok(dueJobs(at("2026-11-24T15:30:00Z"), runs).length === 1, "again next day")
  ok(dueJobs(at("2026-11-23T20:00:00Z"), runs).map((j) => j.name).join() === "backup", "backup at 01:30 IST")
  ok(istClock(at("2026-11-23T20:00:00Z")).day === "2026-11-24", "01:30 IST is the next IST day")
  console.log("scheduler OK")
}
