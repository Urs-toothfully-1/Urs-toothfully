import { prisma } from "@/lib/prisma"
import { appointmentService } from "@/server/services/appointment.service"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"

import { UNKNOWN_DOB } from "@/lib/patient-dob"

async function nextPatientId(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.patient.findFirst({
    where: { patientId: { startsWith: `PAT-${year}-` } },
    orderBy: { patientId: "desc" },
    select: { patientId: true },
  })
  const next = latest ? parseInt(latest.patientId.split("-")[2]) + 1 : 1
  return `PAT-${year}-${String(next).padStart(5, "0")}`
}

export const appointmentRequestService = {
  async listPending(branchId?: string) {
    return prisma.appointmentRequest.findMany({
      where: { status: "PENDING", ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })
  },

  async countPending(branchId?: string): Promise<number> {
    return prisma.appointmentRequest.count({ where: { status: "PENDING", ...(branchId ? { branchId } : {}) } })
  },

  /** Confirms a request into a real Appointment. Reuses an existing patient
   * matched by mobile, otherwise creates a lightweight stub patient. */
  async confirm(
    requestId: string,
    input: { doctorId: string; scheduledAt: Date; durationMins?: number },
    handledById: string
  ) {
    const request = await prisma.appointmentRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new Error("Request not found")
    if (request.status !== "PENDING") throw new Error("This request has already been handled.")

    let patient = await prisma.patient.findFirst({
      where: { mobile: request.mobile, isDeleted: false },
      select: { id: true },
    })
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          patientId: await nextPatientId(),
          registrationBranchId: request.branchId,
          fullName: request.fullName,
          mobile: request.mobile,
          dateOfBirth: UNKNOWN_DOB,
          gender: "OTHER",
          leadSource: "Online Appointment Request",
          reasonForVisit: request.problem ?? undefined,
          createdById: handledById,
        },
        select: { id: true },
      })
    }

    // Record the opt-in captured on the public form against the real patient.
    // Must happen BEFORE create() — that is what fires the confirmation, and
    // the WhatsApp queue refuses to enqueue for a patient without consent.
    if (request.whatsappConsent) {
      await whatsappService.setConsent(patient.id, true, request.consentIp ?? undefined).catch(() => null)
    }

    const appointment = await appointmentService.create(
      {
        patientId: patient.id,
        doctorId: input.doctorId,
        branchId: request.branchId,
        scheduledAt: input.scheduledAt,
        durationMins: input.durationMins,
        reason: request.problem ?? undefined,
        skipWhatsappGate: true,
      },
      handledById
    )

    await prisma.appointmentRequest.update({
      where: { id: requestId },
      data: { status: "CONFIRMED", appointmentId: appointment.id, handledById, handledAt: new Date() },
    })

    return appointment
  },

  async decline(requestId: string, handledById: string, notes?: string) {
    const request = await prisma.appointmentRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new Error("Request not found")
    if (request.status !== "PENDING") throw new Error("This request has already been handled.")
    await prisma.appointmentRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED", handledById, handledAt: new Date(), notes: notes?.slice(0, 500) },
    })
  },
}
