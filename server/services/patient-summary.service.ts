import { prisma } from "@/lib/prisma"

/**
 * The numbers shown around a patient's profile: what they owe, and how much sits
 * behind each tab.
 *
 * The balance lives here rather than in the page because it is now rendered in
 * two places — the persistent header and the Overview summary. Two copies of the
 * arithmetic is the one way this goes badly wrong: a header that disagrees with
 * the panel below it is worse than showing no balance at all.
 */

export type PatientBalance = {
  estimated: number
  paid: number
  outstanding: number
}

/** Active estimates only — a cancelled plan is not money owed. */
export async function getPatientBalance(patientId: string): Promise<PatientBalance> {
  const estimates = await prisma.estimate.findMany({
    where: { patientId, isDeleted: false, status: "ACTIVE" },
    select: {
      total: true,
      payments: {
        where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
        select: { amount: true },
      },
    },
  })

  const estimated = estimates.reduce((s, e) => s + Number(e.total), 0)
  const paid = estimates.reduce(
    (s, e) => s + e.payments.reduce((ps, p) => ps + Number(p.amount), 0),
    0
  )
  return { estimated, paid, outstanding: Math.max(0, estimated - paid) }
}

export type PatientTabCounts = {
  visits: number
  notes: number
  estimates: number
  payments: number
  documents: number
}

/** Counts for the profile tab strip, so a tab says whether it is worth opening. */
export async function getPatientTabCounts(patientId: string): Promise<PatientTabCounts> {
  const [visits, notes, estimates, payments, documents] = await Promise.all([
    prisma.patientVisit.count({ where: { patientId } }),
    prisma.clinicalNote.count({ where: { patientId } }),
    prisma.estimate.count({ where: { patientId, isDeleted: false } }),
    prisma.payment.count({ where: { patientId, isDeleted: false } }),
    prisma.patientDocument.count({ where: { patientId, isDeleted: false } }),
  ])
  return { visits, notes, estimates, payments, documents }
}
