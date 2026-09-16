import { cache } from "react"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, SessionPayload, verifySession } from "@/lib/session"

// A valid JWT isn't enough: a deactivated account must lose access now, not
// when the token expires. cache() keeps it to one lookup per request.
const isUserActive = cache(async (userId: string) =>
  !!(await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } }))
)

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session || !(await isUserActive(session.userId))) return null
  return session
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
