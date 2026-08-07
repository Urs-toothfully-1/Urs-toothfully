"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { userRepository } from "@/server/repositories/user.repository"
import { BCRYPT_COST_FACTOR } from "@/lib/constants"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"
import { z } from "zod"
import { createAuditLog } from "@/lib/audit"

/**
 * `createdUserId` exists so the client can tell two successful creations apart.
 * A bare `{ success: true }` deserializes to an equal value every time and React
 * may hand back the same object, so an identity check on the state cannot see
 * the second success — which left the "New Staff Account" form stuck open.
 */
export type UserFormState = { success?: boolean; error?: string; createdUserId?: string }

const createUserSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST"]),
  doctorRegNo: z.string().max(20).optional(),
  doctorQualification: z.string().max(200).optional(),
})

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const raw = {
    branchId: formData.get("branchId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    email: formData.get("email")?.toString().toLowerCase().trim() ?? "",
    password: formData.get("password")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? "",
    doctorRegNo: formData.get("doctorRegNo")?.toString() || undefined,
    doctorQualification: formData.get("doctorQualification")?.toString() || undefined,
  }

  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST_FACTOR)
    const created = await userRepository.create({
      branchId: parsed.data.branchId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role as Role,
      doctorRegNo: parsed.data.doctorRegNo,
      doctorQualification: parsed.data.doctorQualification,
    })
    revalidatePath("/admin/users")
    return { success: true, createdUserId: created.id }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return { error: "Email address already in use." }
    }
    return { error: "Failed to create user." }
  }
}

export async function toggleUserActiveAction(
  userId: string,
  isActive: boolean
): Promise<UserFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  if (userId === session.userId) return { error: "Cannot deactivate your own account." }

  try {
    await userRepository.update(userId, { isActive })
    revalidatePath("/admin/users")
    return { success: true }
  } catch {
    return { error: "Failed to update user." }
  }
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string
): Promise<UserFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." }

  // Prevent an ADMIN from resetting another ADMIN's password
  const target = await userRepository.findById(userId)
  if (!target) return { error: "User not found." }
  if (target.role === "ADMIN" && target.id !== session.userId) {
    return { error: "Cannot reset another administrator's password." }
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR)
    await userRepository.update(userId, { passwordHash })

    await createAuditLog({
      entityType: "User",
      entityId: userId,
      action: "UPDATE",
      changedById: session.userId,
      newValues: { action: "password_reset", targetUserId: userId },
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch {
    return { error: "Failed to reset password." }
  }
}
