import { prisma } from "@/lib/prisma"

export interface OutstandingRow {
  estimateId: string
  estimateNo: string
  patientId: string
  patientName: string
  patientMobile: string
  branchName: string
  estimateDate: Date
  daysSince: number
  total: number
  paid: number
  balance: number
}

export async function getOutstandingBalances(branchId?: string): Promise<OutstandingRow[]> {
  const estimates = await prisma.estimate.findMany({
    where: {
      status: "ACTIVE",
      isDeleted: false,
      ...(branchId && { branchId }),
    },
    include: {
      patient: { select: { id: true, patientId: true, fullName: true, mobile: true } },
      branch: { select: { name: true } },
      payments: {
        where: {
          isDeleted: false,
          paymentType: { in: ["ADVANCE", "TREATMENT"] },
        },
        select: { amount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const today = new Date()

  return estimates
    .map((e) => {
      const paid = e.payments.reduce((s, p) => s + Number(p.amount), 0)
      const balance = Math.max(0, Number(e.total) - paid)
      const daysSince = Math.floor(
        (today.getTime() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        estimateId: e.id,
        estimateNo: e.estimateNo,
        patientId: e.patient.id,
        patientName: e.patient.fullName,
        patientMobile: e.patient.mobile,
        branchName: e.branch.name,
        estimateDate: e.createdAt,
        daysSince,
        total: Number(e.total),
        paid,
        balance,
      }
    })
    .filter((r) => r.balance > 0.01)
    .sort((a, b) => b.balance - a.balance)
}
