"use server"

import { revalidatePath } from "next/cache"
import { requireRole, getSession } from "@/lib/auth"
import { queueService } from "@/server/services/queue.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"

export type AddToQueueState = {
  success?: boolean
  error?: string
  queueId?: string
}

export async function addToQueueAction(
  _prev: AddToQueueState,
  formData: FormData
): Promise<AddToQueueState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const patientId = formData.get("patientId")?.toString()
  const visitType = formData.get("visitType")?.toString()
  const doctorId = formData.get("doctorId")?.toString() || undefined
  const chiefComplaint = formData.get("chiefComplaint")?.toString() || undefined

  if (!patientId || !visitType) {
    return { error: "Patient and visit type are required." }
  }

  const mode = await settingsRepository.get("queue_assignment_mode", session.branchId)

  if (mode === "SPECIFIC_DOCTOR" && !doctorId) {
    return { error: "Please select a doctor." }
  }

  try {
    const { queueEntry } = await queueService.addToQueue(
      {
        patientId,
        branchId: session.branchId,
        visitType: visitType as any,
        chiefComplaint,
        doctorId,
      },
      session.userId
    )

    revalidatePath("/reception")
    revalidatePath("/doctor")
    return { success: true, queueId: queueEntry.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add to queue." }
  }
}

export async function updateQueueStatusAction(
  queueId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Unauthorized" }

  // Branch ownership: non-ADMIN may only update entries in their own branch
  if (session.role !== "ADMIN") {
    const entry = await queueRepository.findById(queueId)
    if (!entry) return { success: false, error: "Queue entry not found." }
    if (entry.branchId !== session.branchId) return { success: false, error: "Forbidden." }
  }

  try {
    await queueService.updateStatus(queueId, status as any, session.userId)
    revalidatePath("/reception")
    revalidatePath("/doctor")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update status." }
  }
}

export async function claimPatientAction(
  queueId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    await queueService.claimPatient(queueId, session.userId)
    revalidatePath("/doctor")
    revalidatePath("/reception")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to claim patient." }
  }
}
