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
  const secret = process.env.JWT_SECRET
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
  secure: process.env.NODE_ENV === "production",
  // "lax" (not "strict") so the cookie is sent when switching browser tabs
  // and on mobile browsers where strict drops the cookie during navigation
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_HOURS * 60 * 60,
}
