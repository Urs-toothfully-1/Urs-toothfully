import { createRemoteJWKSet, jwtVerify } from "jose"

/**
 * Verifies a Google Identity Services ID token (the JWT returned by the
 * "Sign in with Google" button) against Google's public keys, using jose —
 * no extra dependency. Returns the verified email, or null if anything is off.
 *
 * Activated by NEXT_PUBLIC_GOOGLE_CLIENT_ID (the OAuth client ID). When unset,
 * Google sign-in is simply disabled.
 */

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

export interface GoogleIdentity {
  email: string
  name?: string
  emailVerified: boolean
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) return null

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId, // must be minted for OUR app, not any Google login
    })
    const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : ""
    if (!email) return null
    return {
      email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      emailVerified: payload.email_verified === true,
    }
  } catch {
    return null
  }
}
