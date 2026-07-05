import { queueRepository } from "@/server/repositories/queue.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"

export const addToQueueSchema = z.object({
  patientId: z.string().uuid(),
  branchId: z.string().uuid(),
  visitType: z.enum(["CONSULTATION", "TREATMENT_SESSION", "FOLLOW_UP", "EMERGENCY_VISIT", "REVIEW"]),
  chiefComplaint: z.string().max(500).optional(),
  doctorId: z.string().uuid().optional(),
})

export type AddToQueueInput = z.infer<typeof addToQueueSchema>

async function generateNextVisitNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await visitRepository.getLatestVisitNoForYear(year)
  const next = latest ? parseInt(latest.split("-")[2]) + 1 : 1
  return `VISIT-${year}-${String(next).padStart(5, "0")}`
}

export const queueService = {
  async getTodayQueue(branchId: string, date?: Date) {
    return queueRepository.findByBranchAndDate(branchId, date ?? new Date())
  },

  async getDoctorQueue(doctorId: string, date?: Date) {
    return queueRepository.findByDoctorAndDate(doctorId, date ?? new Date())
  },

  async addToQueue(input: AddToQueueInput, createdById: string) {
    const visitNo = await generateNextVisitNo()
    const assignmentMode = await settingsRepository.get("queue_assignment_mode", input.branchId)

    // In SPECIFIC_DOCTOR mode a doctorId must be provided
    if (assignmentMode === "SPECIFIC_DOCTOR" && !input.doctorId) {
      throw new Error("Doctor must be selected in SPECIFIC_DOCTOR mode")
    }

    const visit = await visitRepository.create({
      visitNo,
      patientId: input.patientId,
      branchId: input.branchId,
      doctorId: input.doctorId,
      visitType: input.visitType,
      chiefComplaint: input.chiefComplaint,
      createdById,
    })

    const tokenNumber = await queueRepository.getNextTokenNumber(input.branchId, new Date())

    const queueEntry = await queueRepository.create({
      visitId: visit.id,
      patientId: input.patientId,
      branchId: input.branchId,
      doctorId: input.doctorId,
      tokenNumber,
      createdById,
    })

    await createAuditLog({
      entityType: "QueueEntry",
      entityId: queueEntry.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { visitNo, tokenNumber, doctorId: input.doctorId },
      branchId: input.branchId,
    })

    return { visit, queueEntry }
  },

  async updateStatus(
    queueId: string,
    status: "WAITING" | "WITH_DOCTOR" | "ESTIMATE_CREATED" | "PAYMENT_PENDING" | "COMPLETED" | "CANCELLED",
    updatedById: string
  ) {
    const extras: Record<string, Date> = {}
    if (status === "WITH_DOCTOR") extras.calledAt = new Date()
    if (status === "COMPLETED") extras.completedAt = new Date()

    const entry = await queueRepository.updateStatus(queueId, status, extras)

    // Keep the visit's own status in sync — otherwise it stays IN_PROGRESS
    // forever and old visits keep surfacing in payment/queue screens.
    if (status === "COMPLETED" || status === "CANCELLED") {
      await visitRepository.updateStatus(entry.visitId, status).catch(() => {})
    }

    await createAuditLog({
      entityType: "QueueEntry",
      entityId: queueId,
      action: "STATUS_CHANGE",
      changedById: updatedById,
      newValues: { status },
    })

    return entry
  },

  async claimPatient(queueId: string, doctorId: string) {
    const entry = await queueRepository.findById(queueId)
    if (!entry) throw new Error("Queue entry not found")
    if (entry.doctorId) throw new Error("Patient already claimed by a doctor")
    if (entry.status !== "WAITING") throw new Error("Patient is not in WAITING status")

    const updated = await queueRepository.updateStatus(queueId, "WITH_DOCTOR", {
      doctorId,
      claimedAt: new Date(),
      calledAt: new Date(),
    })

    await createAuditLog({
      entityType: "QueueEntry",
      entityId: queueId,
      action: "CLAIM",
      changedById: doctorId,
      newValues: { doctorId, status: "WITH_DOCTOR" },
    })

    return updated
  },
}
