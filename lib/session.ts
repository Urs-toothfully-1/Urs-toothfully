import { SignJWT, jwtVerify } from "jose"
import { SESSION_DURATION_HOURS } from "@/lib/constants"

export type Role = "ADMIN" | "DOCTOR" | "RECEPTIONIST"

export interface SessionPayload {
  userId: string
  role: Role
  branchId: string
  name: string
  iat?: number
  exp?: number
}

function getJwtSecret(): Uint8Array {
  // Trim to stay byte-identical with proxy.ts verification — a stray
  // trailing newline in the env var must not produce a different key.
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret) throw new Error("JWT_SECRET environment variable is not set")
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters")
  return new TextEncoder().encode(secret)
}

export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  const secret = getJwtSecret()
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(secret)
  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME = "toothfully_session"

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // Only mark Secure when explicitly deployed over HTTPS.
  // NODE_ENV=production is true even on a local LAN (npm run start),
  // and mobile browsers refuse to send Secure cookies over plain HTTP.
  secure: process.env.SECURE_COOKIES === "true",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_HOURS * 60 * 60,
}
