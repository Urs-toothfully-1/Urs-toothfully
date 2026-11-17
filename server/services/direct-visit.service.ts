import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { generateNextVisitNo } from "@/server/services/queue.service"
import { prescriptionService } from "@/server/services/prescription.service"

/**
 * Prescriptions / estimates started straight from the patient profile — no
 * queue entry. Admin and reception (with access) pick the doctor whose name
 * goes on the prescription; the visit records who actually created it, and
 * every step is in the audit log.
 */
export const directVisitService = {
  async start(input: {
    patientId: string
    doctorId: string
    chiefComplaint?: string
    branchId: string
    userId: string
  }) {
    const [patient, doctor] = await Promise.all([
      prisma.patient.findFirst({
        where: { id: input.patientId, isDeleted: false },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { id: input.doctorId, role: "DOCTOR", isActive: true },
        select: { id: true, name: true },
      }),
    ])
    if (!patient) throw new Error("Patient not found.")
    if (!doctor) throw new Error("Choose an active doctor.")

    const visit = await prisma.patientVisit.create({
      data: {
        visitNo: await generateNextVisitNo(),
        patientId: input.patientId,
        branchId: input.branchId,
        doctorId: doctor.id,
        visitType: "CONSULTATION",
        status: "IN_PROGRESS",
        chiefComplaint: input.chiefComplaint?.trim().slice(0, 500) || null,
        createdById: input.userId,
      },
    })
    await prescriptionService.ensureForVisit(visit.id, input.userId)
    await createAuditLog({
      entityType: "PatientVisit",
      entityId: visit.id,
      action: "CREATE",
      changedById: input.userId,
      branchId: input.branchId,
      newValues: {
        action: "direct_visit_from_profile",
        patientId: input.patientId,
        visitNo: visit.visitNo,
        doctor: doctor.name,
      },
    })
    return visit
  },

  /** Finish a profile-started visit (no queue entry to complete). */
  async complete(visitId: string, userId: string) {
    const visit = await prisma.patientVisit.findUnique({
      where: { id: visitId },
      select: { status: true, queueEntry: { select: { id: true } } },
    })
    if (!visit || visit.queueEntry || visit.status !== "IN_PROGRESS") return
    await prisma.patientVisit.update({ where: { id: visitId }, data: { status: "COMPLETED" } })
    await createAuditLog({
      entityType: "PatientVisit",
      entityId: visitId,
      action: "COMPLETE",
      changedById: userId,
    })
  },

  /**
   * Cancel a visit and its estimates from the patient profile. Refused once money
   * is involved (payments or invoices) — those are reversed through billing, not here.
   */
  async cancel(visitId: string, reason: string, userId: string) {
    const visit = await prisma.patientVisit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        status: true,
        visitNo: true,
        payments: { where: { isDeleted: false }, select: { id: true } },
        estimates: {
          where: { isDeleted: false },
          select: {
            id: true,
            payments: { where: { isDeleted: false }, select: { id: true } },
            invoices: { where: { isDeleted: false }, select: { id: true } },
          },
        },
        queueEntry: { select: { id: true, status: true } },
      },
    })
    if (!visit) throw new Error("Visit not found.")
    if (visit.status === "CANCELLED") throw new Error("This visit is already cancelled.")
    const money =
      visit.payments.length +
      visit.estimates.reduce((n, e) => n + e.payments.length + e.invoices.length, 0)
    if (money > 0)
      throw new Error("This visit has payments or invoices — reverse those first, then cancel.")
    const why = reason.trim()
    if (why.length < 3) throw new Error("Give a short reason for cancelling.")

    await prisma.$transaction([
      prisma.patientVisit.update({
        where: { id: visitId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledById: userId,
          cancelReason: why.slice(0, 300),
        },
      }),
      prisma.estimate.updateMany({
        where: { visitId, isDeleted: false },
        data: { status: "CANCELLED" },
      }),
      ...(visit.queueEntry && !["COMPLETED", "CANCELLED"].includes(visit.queueEntry.status)
        ? [
            prisma.queueEntry.update({
              where: { id: visit.queueEntry.id },
              data: { status: "CANCELLED" },
            }),
          ]
        : []),
    ])
    await createAuditLog({
      entityType: "PatientVisit",
      entityId: visitId,
      action: "STATUS_CHANGE",
      changedById: userId,
      previousValues: { status: visit.status },
      newValues: { status: "CANCELLED", visitNo: visit.visitNo, estimates: visit.estimates.length },
      reason: why,
    })
  },
}
