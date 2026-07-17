"use server"

import { revalidatePath } from "next/cache"
import { requireRole, getSession } from "@/lib/auth"
import { appointmentService } from "@/server/services/appointment.service"
import { appointmentRequestService } from "@/server/services/appointment-request.service"
import type { AppointmentStatus } from "@prisma/client"

export type CreateAppointmentState = {
  success?: boolean
  error?: string
}

export async function createAppointmentAction(
  _prev: CreateAppointmentState,
  formData: FormData
): Promise<CreateAppointmentState> {
  // Doctors may book too (e.g. a follow-up during a visit), booking with themselves.
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const patientId = formData.get("patientId")?.toString()
  const doctorId = session.role === "DOCTOR" ? session.userId : formData.get("doctorId")?.toString()
  const branchId = formData.get("branchId")?.toString() || session.branchId
  const date = formData.get("date")?.toString()
  const time = formData.get("time")?.toString()
  const durationMins = parseInt(formData.get("durationMins")?.toString() ?? "30", 10) || 30
  const reason = formData.get("reason")?.toString().trim() || undefined

  if (!patientId || !doctorId || !date || !time) {
    return { error: "Patient, doctor, date and time are required." }
  }

  const scheduledAt = new Date(`${date}T${time}`)
  if (isNaN(scheduledAt.getTime())) return { error: "Invalid date or time." }

  try {
    await appointmentService.create(
      { patientId, doctorId, branchId, scheduledAt, durationMins, reason },
      session.userId
    )
    revalidatePath("/appointments", "page")
    revalidatePath(`/patients/${patientId}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create appointment." }
  }
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  date: string,
  time: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Unauthorized" }

  const scheduledAt = new Date(`${date}T${time}`)
  if (isNaN(scheduledAt.getTime())) return { success: false, error: "Invalid date or time." }

  try {
    await appointmentService.reschedule(appointmentId, scheduledAt, session.userId)
    revalidatePath("/appointments", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reschedule." }
  }
}

export async function confirmAppointmentRequestAction(
  requestId: string,
  doctorId: string,
  date: string,
  time: string,
  durationMins = 30
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }
  if (!doctorId || !date || !time) return { success: false, error: "Doctor, date and time are required." }

  const scheduledAt = new Date(`${date}T${time}`)
  if (isNaN(scheduledAt.getTime())) return { success: false, error: "Invalid date or time." }

  try {
    await appointmentRequestService.confirm(requestId, { doctorId, scheduledAt, durationMins }, session.userId)
    revalidatePath("/appointments", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to confirm request." }
  }
}

export async function declineAppointmentRequestAction(
  requestId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }
  try {
    await appointmentRequestService.decline(requestId, session.userId, notes)
    revalidatePath("/appointments", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to decline request." }
  }
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
  cancellationReason?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    await appointmentService.updateStatus(appointmentId, status, session.userId, cancellationReason)
    revalidatePath("/appointments", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update appointment." }
  }
}
