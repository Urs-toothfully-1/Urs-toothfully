import { prisma } from "@/lib/prisma"
import { generateReferralCode } from "@/lib/referral-code"
import { appointmentService } from "@/server/services/appointment.service"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { referralService } from "@/server/services/referral.service"

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

/**
 * Reuses an existing patient matched by mobile, otherwise creates a lightweight
 * stub (unknown DOB/gender, flagged "Profile incomplete") for a phone/walk-in
 * or online booking. Reception completes the real profile when the patient
 * registers at the desk.
 */
export async function findOrCreateStubPatient(
  input: { fullName: string; mobile: string; branchId: string; problem?: string | null; leadSource?: string },
  createdById: string
): Promise<{ id: string; created: boolean }> {
  // Match on the last 10 digits so "09876…" / "+91 98765…" find the same patient
  // as "98765…" instead of creating a duplicate.
  const mobile = input.mobile.replace(/\D/g, "").slice(-10)
  if (mobile.length !== 10) throw new Error("Enter a valid 10-digit mobile number.")
  const existing = await prisma.patient.findFirst({
    where: { mobile: { endsWith: mobile }, isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  const patient = await prisma.patient.create({
    data: {
      patientId: await nextPatientId(),
      registrationBranchId: input.branchId,
      fullName: input.fullName.trim(),
      mobile,
      dateOfBirth: UNKNOWN_DOB,
      gender: "OTHER",
      leadSource: input.leadSource ?? "Online Appointment Request",
      reasonForVisit: input.problem?.trim() || undefined,
      referralCode: generateReferralCode(),
      createdById,
    },
    select: { id: true },
  })
  return { id: patient.id, created: true }
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

    const referrer = request.referralCode ? await referralService.findReferrerByCode(request.referralCode).catch(() => null) : null
    const patient = await findOrCreateStubPatient(
      {
        fullName: request.fullName, mobile: request.mobile, branchId: request.branchId, problem: request.problem,
        leadSource: referrer ? "Referral" : undefined,
      },
      handledById
    )
    // Record the opt-in captured on the public form against the real patient.
    // Must happen BEFORE the referral (it WhatsApps both patients) and before
    // create() (the confirmation) — the queue refuses patients without consent.
    if (request.whatsappConsent) {
      await whatsappService.setConsent(patient.id, true, request.consentIp ?? undefined).catch(() => null)
    }

    // Booked from a friend's /rewards link → record who referred them. Only for
    // someone genuinely new: an existing patient who has already paid isn't a
    // referral (and would otherwise earn both sides 500 points). No-op if they
    // already have a referrer or the link is their own.
    if (referrer && referrer.id !== patient.id) {
      const alreadyPaying =
        !patient.created &&
        (await prisma.payment.count({ where: { patientId: patient.id, isDeleted: false } })) > 0
      if (!alreadyPaying) {
        await referralService
          .createReferral({ referrerId: referrer.id, refereeId: patient.id, branchId: request.branchId, createdById: handledById })
          .catch(() => null)
      }
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
