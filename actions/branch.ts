"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/session"
import { prisma } from "@/lib/prisma"

/**
 * Doctors rotate across all branches every day. This re-issues the session
 * token with the chosen active branch so `session.branchId` reflects it
 * everywhere (queue pool, settings, new-visit defaults) without re-login.
 */
export async function switchActiveBranchAction(
  branchId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, isActive: true },
    select: { id: true },
  })
  if (!branch) return { success: false, error: "Branch not found or inactive." }

  const token = await createSession({
    userId: session.userId,
    role: session.role,
    branchId: branch.id,
    name: session.name,
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS)

  revalidatePath("/doctor")
  return { success: true }
}
