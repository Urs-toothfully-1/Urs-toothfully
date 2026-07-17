/**
 * Lightweight bot checks for public forms, independent of Cloudflare.
 *
 * Turnstile is the strong layer, but it fails OPEN when TURNSTILE_SECRET_KEY is
 * unset (deliberate, for LAN kiosk deployments) — which means a production
 * deploy without the key has no bot protection at all. These checks always run,
 * cost nothing, and catch the overwhelming majority of naive form spam.
 *
 * Neither check can block a determined attacker; they are a floor, not a
 * ceiling. Configure Turnstile for real protection.
 */

/** Name of the hidden field bots tend to auto-fill. Humans never see it. */
export const HONEYPOT_FIELD = "company_website"

/** Name of the hidden field carrying the form render timestamp. */
export const TIMESTAMP_FIELD = "form_loaded_at"

/** Humans take longer than this to fill a form; bots submit instantly. */
const MIN_FILL_MS = 3000

/** Older than this and the page has been sitting open (or the stamp is replayed). */
const MAX_FILL_MS = 6 * 60 * 60 * 1000

export interface BotCheckResult {
  ok: boolean
  /** Kept vague on purpose — never tell a bot which check it tripped. */
  error?: string
  /** For server logs. */
  reason?: string
}

const GENERIC_ERROR = "We couldn't process this submission. Please try again."

export function checkBotSignals(formData: FormData): BotCheckResult {
  // 1. Honeypot — any value means a bot filled a field humans can't see.
  const honeypot = formData.get(HONEYPOT_FIELD)?.toString().trim()
  if (honeypot) return { ok: false, error: GENERIC_ERROR, reason: "honeypot filled" }

  // 2. Timing — instant submits are scripted. A missing/garbled stamp means the
  //    form wasn't rendered by our client, so treat it as a bot too.
  const raw = formData.get(TIMESTAMP_FIELD)?.toString()
  const loadedAt = raw ? Number(raw) : NaN
  if (!Number.isFinite(loadedAt)) return { ok: false, error: GENERIC_ERROR, reason: "missing timestamp" }

  const elapsed = Date.now() - loadedAt
  if (elapsed < MIN_FILL_MS) return { ok: false, error: GENERIC_ERROR, reason: `submitted in ${elapsed}ms` }
  if (elapsed > MAX_FILL_MS) {
    return { ok: false, error: "This form expired. Please refresh the page and try again.", reason: "stale form" }
  }

  return { ok: true }
}

/** Warns once per cold start when a public form is running without Turnstile. */
let warned = false
export function warnIfTurnstileMissing(route: string): void {
  if (warned || process.env.NODE_ENV !== "production" || process.env.TURNSTILE_SECRET_KEY) return
  warned = true
  console.warn(
    `[security] TURNSTILE_SECRET_KEY is not set — ${route} is running without captcha. ` +
      `Only honeypot, timing and per-IP rate limits apply. Set the key to enable full bot protection.`
  )
}
