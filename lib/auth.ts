import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, SessionPayload, verifySession } from "@/lib/session"

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    throw new Error("UNAUTHORIZED")
  }
  return session
}

export async function requireRole(
  allowedRoles: SessionPayload["role"][]
): Promise<SessionPayload> {
  const session = await requireSession()
  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN")
  }
  return session
}
