"use server"

import { revalidatePath } from "next/cache"
import { gate, requireRole } from "@/lib/auth"
import { directVisitService } from "@/server/services/direct-visit.service"
import { requirePatientInScope } from "@/server/services/patient-scope.service"
import { prisma } from "@/lib/prisma"

/** Admin, or reception with "Create prescriptions & estimates from the patient profile". */
const profileStaff = () =>
  requireRole(["ADMIN", "RECEPTIONIST"])
    .then(gate("directClinical"))
    .catch(() => null)
const fail = (e: unknown, fallback: string) => ({
  error: e instanceof Error ? e.message : fallback,
})

export async function startDirectVisitAction(
  patientId: string,
  doctorId: string,
  chiefComplaint?: string
) {
  // Admin / reception (with access), or a doctor with "Write prescriptions" — as herself.
  const session =
    (await profileStaff()) ??
    (await requireRole(["DOCTOR"])
      .then(gate("prescriptions"))
      .catch(() => null))
  if (!session)
    return { error: "You don't have access to create prescriptions from the patient profile." }
  if (session.role === "DOCTOR") doctorId = session.userId
  try {
    await requirePatientInScope(session, patientId)
    const visit = await directVisitService.start({
      patientId,
      doctorId,
      chiefComplaint,
      branchId: session.branchId,
      userId: session.userId,
    })
    revalidatePath(`/patients/${patientId}`)
    return { success: true as const, visitId: visit.id }
  } catch (e) {
    return fail(e, "Could not start.")
  }
}

/** Marks a profile-started visit complete when the wizard finishes (queue visits are completed by the queue). */
export async function completeDirectVisitAction(visitId: string) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    .then(gate("prescriptions", "directClinical"))
    .catch(() => null)
  if (!session) return { error: "Unauthorized" }
  await directVisitService.complete(visitId, session.userId)
  const v = await prisma.patientVisit.findUnique({
    where: { id: visitId },
    select: { patientId: true },
  })
  if (v) revalidatePath(`/patients/${v.patientId}`)
  return { success: true as const }
}

export async function cancelVisitAction(visitId: string, reason: string) {
  const session = await profileStaff()
  if (!session) return { error: "You don't have access to cancel visits." }
  try {
    const v = await prisma.patientVisit.findUnique({
      where: { id: visitId },
      select: { patientId: true },
    })
    if (!v) return { error: "Visit not found." }
    await requirePatientInScope(session, v.patientId)
    await directVisitService.cancel(visitId, reason, session.userId)
    revalidatePath(`/patients/${v.patientId}`, "layout")
    return { success: true as const }
  } catch (e) {
    return fail(e, "Could not cancel.")
  }
}
