"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { createAuditLog } from "@/lib/audit"

export type SettingsFormState = { success?: boolean; error?: string }

const ALLOWED_SETTING_KEYS = new Set([
  "advance_percent",
  "allow_discount",
  "consultation_fee",
  "queue_assignment_mode",
  "prescription_mode",
])

export async function updateSettingAction(
  key: string,
  value: string,
  branchId: string | undefined
): Promise<SettingsFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  if (!ALLOWED_SETTING_KEYS.has(key)) return { error: "Unknown setting key." }
  if (value === undefined || value === null) return { error: "Value is required." }

  try {
    const before = await settingsRepository.get(key, branchId)
    await settingsRepository.set(key, value, session.userId, branchId)

    await createAuditLog({
      entityType: "SystemSetting",
      entityId: branchId ?? "global",
      action: "UPDATE",
      changedById: session.userId,
      previousValues: { key, value: before },
      newValues: { key, value },
      branchId,
    })

    revalidatePath("/admin/settings")
    return { success: true }
  } catch {
    return { error: "Failed to update setting." }
  }
}
