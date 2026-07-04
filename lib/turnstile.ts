/**
 * Cloudflare Turnstile server-side verification for the public intake form.
 * Configure TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY in .env.local.
 * When no secret is configured (e.g. LAN kiosk deployments), verification is
 * skipped so the intake flow keeps working.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export interface TurnstileResult {
  success: boolean
  skipped?: boolean
  error?: string
}

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstileToken(token: string | null, remoteIp?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { success: true, skipped: true }

  if (!token) return { success: false, error: "Verification missing. Please complete the security check." }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set("remoteip", remoteIp)

    const res = await fetch(VERIFY_URL, { method: "POST", body })
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] }

    if (!data.success) {
      return { success: false, error: "Security verification failed. Please try again." }
    }
    return { success: true }
  } catch {
    // Cloudflare unreachable — fail closed for a bot-protection feature
    return { success: false, error: "Could not verify the security check. Please try again." }
  }
}
