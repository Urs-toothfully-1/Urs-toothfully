import { prisma } from "@/lib/prisma"

/**
 * DB-backed rate limiting for the public intake registration.
 * Limits: 3 attempts per IP per hour, 20 per IP per day.
 *
 * Counts ALL recorded attempts (successful and failed), so a bot spamming the
 * endpoint with junk/invalid submissions is throttled the same as real ones —
 * previously only successes were counted, which let invalid floods bypass it.
 */

export const INTAKE_LIMITS = {
  perHour: 3,
  perDay: 20,
} as const

export interface RateLimitResult {
  allowed: boolean
  error?: string
}

export async function checkIntakeRateLimit(ipAddress: string): Promise<RateLimitResult> {
  if (!ipAddress) return { allowed: true } // can't attribute — don't block

  const now = Date.now()
  const [lastHour, lastDay] = await Promise.all([
    prisma.intakeAttempt.count({
      where: { ipAddress, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    }),
    prisma.intakeAttempt.count({
      where: { ipAddress, createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    }),
  ])

  if (lastHour >= INTAKE_LIMITS.perHour) {
    return { allowed: false, error: "Too many registrations from this device. Please try again after an hour or visit the front desk." }
  }
  if (lastDay >= INTAKE_LIMITS.perDay) {
    return { allowed: false, error: "The daily registration limit for this device has been reached. Please visit the front desk." }
  }
  return { allowed: true }
}

export async function recordIntakeAttempt(ipAddress: string, success: boolean): Promise<void> {
  if (!ipAddress) return
  try {
    await prisma.intakeAttempt.create({ data: { ipAddress, success } })
  } catch {
    // never let bookkeeping break registration
  }
}

/**
 * Extracts the client IP from proxy headers.
 *
 * NOTE: `x-forwarded-for` is only trustworthy when set by a trusted proxy in
 * front of the app (e.g. Vercel/Cloudflare, which overwrite the left-most hop
 * with the real client IP). Do not treat this as spoof-proof on a raw origin
 * with no proxy; pair it with the Turnstile bot check for public endpoints.
 */
export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return headers.get("x-real-ip") ?? ""
}
