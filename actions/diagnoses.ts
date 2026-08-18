"use server"

import { requireRole } from "@/lib/auth"
import { diagnosisService } from "@/server/services/diagnosis.service"
import type { PhraseSection } from "@/server/repositories/diagnosis.repository"
import type { Diagnosis } from "@prisma/client"

const SECTIONS: PhraseSection[] = ["DIAGNOSIS", "COMPLAINT"]

/**
 * Saves a phrase the doctor typed into the reusable library for their branch.
 * Idempotent — an existing entry with the same wording is returned as-is.
 */
export async function createCustomDiagnosisAction(
  name: string,
  specialty: string,
  section: string = "DIAGNOSIS"
): Promise<{ success: boolean; diagnosis?: Diagnosis; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: "Name is required" }
  if (trimmed.length > 300) return { success: false, error: "Name is too long" }

  const resolved = SECTIONS.find((s) => s === section)
  if (!resolved) return { success: false, error: "Unknown section" }

  try {
    const diagnosis = await diagnosisService.createCustomDiagnosis(
      session.branchId,
      trimmed,
      specialty,
      session.userId,
      resolved
    )

    if (!diagnosis) return { success: false, error: "Failed to save entry" }

    // Return the saved record, not a client-side guess at its shape.
    return { success: true, diagnosis }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save entry",
    }
  }
}

export async function trackDiagnosisUsageAction(
  diagnosisId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    await diagnosisService.trackDiagnosisUsage(session.userId, diagnosisId, session.branchId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to track usage",
    }
  }
}
