import { cache } from "react"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, SessionPayload, verifySession } from "@/lib/session"
import { effectivePerms, PERMISSIONS, type PermissionKey, type Perms } from "@/lib/permissions"

export type AppSession = SessionPayload & { perms: Perms }

// A valid JWT isn't enough: a deactivated account must lose access now, not
// when the token expires. cache() keeps it to one lookup per request.
// Permissions are read fresh too, so an admin's change applies on the next click.
const loadActiveUser = cache(async (userId: string) =>
  prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { permissions: true } })
)

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const session = await verifySession(token)
  if (!session) return null
  const user = await loadActiveUser(session.userId)
  if (!user) return null
  return { ...session, perms: effectivePerms(session.role, user.permissions) }
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession()
  if (!session) {
    throw new Error("UNAUTHORIZED")
  }
  return session
}

export async function requireRole(
  allowedRoles: SessionPayload["role"][]
): Promise<AppSession> {
  const session = await requireSession()
  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN")
  }
  return session
}

/** Throws FORBIDDEN unless the user has every listed permission (admins always do). */
export async function requirePerm(...keys: PermissionKey[]): Promise<AppSession> {
  const session = await requireSession()
  if (keys.some((k) => !session.perms[k])) throw new Error("FORBIDDEN")
  return session
}

/**
 * For server actions: `requireRole([...]).then(gate("prices")).catch(() => null)`
 * turns a user whose admin switched the feature off into "no session", so the
 * action's existing unauthorised path answers. A key only counts for the roles
 * it applies to (e.g. "collectPayments" never blocks a doctor).
 */
export function gate(...keys: PermissionKey[]) {
  return (session: AppSession): AppSession => {
    const blocked = keys.some(
      (k) => (PERMISSIONS[k].roles as readonly string[]).includes(session.role) && !session.perms[k]
    )
    if (blocked) throw new Error("FORBIDDEN")
    return session
  }
}
