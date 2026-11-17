import { cache } from "react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { istDayRange, istTodayStr } from "@/lib/ist"
import type { AppSession } from "@/lib/auth"

/**
 * "Today's patients" for users whose admin switched off `allPatients`:
 *  - doctor:    today's appointments, queue entries and visits assigned to them
 *  - reception: today's appointments, queue and visits at their branch
 * Returns null when the user may see everyone. cache() = one lookup per request.
 */
export const allowedPatientIds = cache(async (session: AppSession): Promise<Set<string> | null> => {
  if (session.perms.allPatients) return null
  const { start, end } = istDayRange(istTodayStr())
  const isDoctor = session.role === "DOCTOR"

  const [appts, queue, visits] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
        ...(isDoctor ? { doctorId: session.userId } : { branchId: session.branchId }),
      },
      select: { patientId: true },
    }),
    prisma.queueEntry.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(isDoctor ? { doctorId: session.userId } : { branchId: session.branchId }),
      },
      select: { patientId: true },
    }),
    // Visits started from the patient profile have no queue entry.
    prisma.patientVisit.findMany({
      where: {
        visitDate: { gte: start, lte: end },
        status: { not: "CANCELLED" },
        ...(isDoctor ? { doctorId: session.userId } : { branchId: session.branchId }),
      },
      select: { patientId: true },
    }),
  ])
  return new Set([...appts, ...queue, ...visits].map((r) => r.patientId))
})

export async function canSeePatient(session: AppSession, patientId: string): Promise<boolean> {
  const ids = await allowedPatientIds(session)
  return !ids || ids.has(patientId)
}

/** Page guard: a patient outside the user's scope looks like "not found". */
export async function assertPatientInScope(session: AppSession, patientId: string): Promise<void> {
  if (!(await canSeePatient(session, patientId))) notFound()
}

/** API/action guard: throws FORBIDDEN (callers already map that to 403). */
export async function requirePatientInScope(session: AppSession, patientId: string): Promise<void> {
  if (!(await canSeePatient(session, patientId))) throw new Error("FORBIDDEN")
}
