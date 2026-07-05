import { AppointmentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { WHATSAPP_TRIGGERS } from "@/lib/whatsapp/templates"

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, patientId: true, fullName: true, mobile: true, gender: true, dateOfBirth: true } },
  doctor: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>

function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function formatApptDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

function formatApptTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

export const appointmentService = {
  async create(
    input: {
      patientId: string
      doctorId: string
      branchId: string
      scheduledAt: Date
      durationMins?: number
      reason?: string
    },
    createdById: string
  ): Promise<AppointmentWithRelations> {
    if (input.scheduledAt.getTime() < Date.now() - 60_000) {
      throw new Error("Appointment time is in the past.")
    }

    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: input.patientId, isDeleted: false }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: input.doctorId, role: "DOCTOR", isActive: true }, select: { id: true } }),
    ])
    if (!patient) throw new Error("Patient not found")
    if (!doctor) throw new Error("Doctor not found or inactive")

    // Same-doctor overlap guard: block bookings that collide with an existing
    // SCHEDULED slot for this doctor.
    const durationMins = input.durationMins ?? 30
    const newStart = input.scheduledAt
    const newEnd = new Date(newStart.getTime() + durationMins * 60_000)
    const { start: dayStart, end: dayEnd } = dayRange(newStart)
    const sameDay = await prisma.appointment.findMany({
      where: { doctorId: input.doctorId, status: "SCHEDULED", scheduledAt: { gte: dayStart, lte: dayEnd } },
      select: { scheduledAt: true, durationMins: true },
    })
    const clash = sameDay.some((a) => {
      const s = a.scheduledAt.getTime()
      const e = s + a.durationMins * 60_000
      return newStart.getTime() < e && s < newEnd.getTime()
    })
    if (clash) throw new Error("The doctor already has an appointment in this time slot.")

    const appointment = await prisma.appointment.create({
      data: {
        patientId: input.patientId,
        doctorId: input.doctorId,
        branchId: input.branchId,
        scheduledAt: input.scheduledAt,
        durationMins,
        reason: input.reason,
        createdById,
      },
      include: APPOINTMENT_INCLUDE,
    })

    await createAuditLog({
      entityType: "Appointment",
      entityId: appointment.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { patientId: input.patientId, doctorId: input.doctorId, scheduledAt: input.scheduledAt.toISOString() },
      branchId: input.branchId,
    })

    // Consent + consultation-gated; never throws
    void whatsappService.sendTrigger({
      triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_CONFIRMATION,
      patientId: appointment.patientId,
      variables: [
        appointment.patient.fullName,
        formatApptDate(appointment.scheduledAt),
        formatApptTime(appointment.scheduledAt),
        appointment.branch.name,
      ],
      branchId: appointment.branchId,
      createdById,
    })

    return appointment
  },

  async listForDay(opts: { date: Date; branchId?: string; doctorId?: string }): Promise<AppointmentWithRelations[]> {
    const { start, end } = dayRange(opts.date)
    return prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.doctorId ? { doctorId: opts.doctorId } : {}),
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: "asc" },
    })
  },

  async listUpcomingForPatient(patientId: string): Promise<AppointmentWithRelations[]> {
    return prisma.appointment.findMany({
      where: { patientId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: "asc" },
      take: 5,
    })
  },

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    changedById: string,
    cancellationReason?: string
  ): Promise<AppointmentWithRelations> {
    const existing = await prisma.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE })
    if (!existing) throw new Error("Appointment not found")
    if (existing.status !== "SCHEDULED") throw new Error("Only scheduled appointments can be updated.")

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancellationReason } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    })

    await createAuditLog({
      entityType: "Appointment",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      previousValues: { status: existing.status },
      newValues: { status, cancellationReason },
      branchId: existing.branchId,
    })

    if (status === "CANCELLED") {
      void whatsappService.sendTrigger({
        triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_CANCELLED,
        patientId: appointment.patientId,
        variables: [
          appointment.patient.fullName,
          formatApptDate(appointment.scheduledAt),
          formatApptTime(appointment.scheduledAt),
          appointment.branch.name,
        ],
        branchId: appointment.branchId,
        createdById: changedById,
      })
    }

    return appointment
  },

  /**
   * Enqueues WhatsApp reminders for tomorrow's SCHEDULED appointments that
   * haven't been reminded yet. Meant to be called by a daily cron.
   */
  async sendReminders(): Promise<{ sent: number; skipped: number }> {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const { start, end } = dayRange(tomorrow)

    const due = await prisma.appointment.findMany({
      where: { status: "SCHEDULED", reminderSentAt: null, scheduledAt: { gte: start, lte: end } },
      include: APPOINTMENT_INCLUDE,
    })

    let sent = 0
    let skipped = 0
    for (const appt of due) {
      const result = await whatsappService.sendTrigger({
        triggerKey: WHATSAPP_TRIGGERS.APPOINTMENT_REMINDER,
        patientId: appt.patientId,
        variables: [
          appt.patient.fullName,
          formatApptDate(appt.scheduledAt),
          formatApptTime(appt.scheduledAt),
          appt.branch.name,
        ],
        branchId: appt.branchId,
      })
      if (result.queued) {
        await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } })
        sent++
      } else {
        skipped++
      }
    }
    return { sent, skipped }
  },
}
