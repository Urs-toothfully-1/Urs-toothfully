import { prisma } from "@/lib/prisma"
import { owedAmount, OWED_SELECT } from "@/lib/estimate-owed"

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
  /** What the patient has been billed: legacy estimate totals + invoiced treatment. */
  estimated: number
  paid: number
  outstanding: number
  /** Paid ahead of billing on quote-only estimates (advance not yet used up by invoices). */
  credit: number
}

/** Active estimates only — a cancelled plan is not money owed. */
export async function getPatientBalance(patientId: string): Promise<PatientBalance> {
  const estimates = await prisma.estimate.findMany({
    where: { patientId, isDeleted: false, status: "ACTIVE" },
    select: {
      ...OWED_SELECT,
      payments: {
        where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
        select: { amount: true },
      },
    },
  })

  let estimated = 0
  let paid = 0
  let outstanding = 0
  let credit = 0
  for (const e of estimates) {
    const owed = owedAmount(e)
    const p = e.payments.reduce((ps, x) => ps + Number(x.amount), 0)
    estimated += owed
    paid += p
    // Per estimate, so one plan's advance never hides another plan's dues.
    outstanding += Math.max(0, owed - p)
    credit += Math.max(0, p - owed)
  }
  return { estimated, paid, outstanding, credit }
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
