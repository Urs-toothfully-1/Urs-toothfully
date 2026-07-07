"use server"

import { revalidatePath } from "next/cache"
import { requireRole, getSession } from "@/lib/auth"
import { queueService } from "@/server/services/queue.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import type { QueueStatus, VisitType } from "@prisma/client"

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
        visitType: visitType as VisitType,
        chiefComplaint,
        doctorId,
      },
      session.userId
    )

    return { success: true, queueId: queueEntry.id }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Failed to add to queue."
    return { error: errMsg }
  }
}

export async function updateQueueStatusAction(
  queueId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Unauthorized" }

  // Ownership: non-ADMIN may update entries in their own branch;
  // a DOCTOR may also update entries assigned to them at any branch (doctors rotate across branches)
  if (session.role !== "ADMIN") {
    const entry = await queueRepository.findById(queueId)
    if (!entry) return { success: false, error: "Queue entry not found." }
    const isAssignedDoctor = session.role === "DOCTOR" && entry.doctorId === session.userId
    if (entry.branchId !== session.branchId && !isAssignedDoctor) {
      return { success: false, error: "Forbidden." }
    }
  }

  try {
    await queueService.updateStatus(queueId, status as QueueStatus, session.userId)
    revalidatePath("/reception")
    revalidatePath("/doctor")
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update status." }
  }
}

export async function startTreatmentSessionAction(data: {
  patientId: string
  branchId: string
  doctorId: string
  pendingTreatments: string[]
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  const chiefComplaint = data.pendingTreatments.length
    ? data.pendingTreatments.join(", ")
    : "Treatment Session"

  try {
    await queueService.addToQueue(
      {
        patientId: data.patientId,
        branchId: data.branchId,
        visitType: "TREATMENT_SESSION",
        chiefComplaint,
        doctorId: data.doctorId,
      },
      session.userId
    )

    revalidatePath(`/patients/${data.patientId}`)
    revalidatePath("/doctor")
    revalidatePath("/reception")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start session." }
  }
}

export async function completeTreatmentSessionAction(data: {
  queueId: string
  patientId: string
  completedItemIds: string[]
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    const { estimateService } = await import("@/server/services/estimate.service")
    await Promise.all(
      data.completedItemIds.map((id) =>
        estimateService.updateItemStatus(id, "COMPLETED", session.userId)
      )
    )
    await queueService.updateStatus(data.queueId, "COMPLETED", session.userId)
    revalidatePath(`/patients/${data.patientId}/progress`)
    revalidatePath(`/patients/${data.patientId}`)
    revalidatePath(`/doctor/treatment-session/${data.queueId}`)
    revalidatePath("/doctor")
    revalidatePath("/reception")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to complete session." }
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
