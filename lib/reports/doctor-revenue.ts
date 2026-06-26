import { prisma } from "@/lib/prisma"

export interface DoctorRevenueRow {
  doctorId: string
  doctorName: string
  doctorRegNo: string | null
  estimateCount: number
  estimateTotal: number
  patientCount: number
}

export async function getDoctorRevenue(
  fromDate: Date,
  toDate: Date,
  branchId?: string
): Promise<DoctorRevenueRow[]> {
  const estimates = await prisma.estimate.findMany({
    where: {
      isDeleted: false,
      createdAt: { gte: fromDate, lte: toDate },
      ...(branchId && { branchId }),
    },
    select: {
      doctorId: true,
      total: true,
      patientId: true,
      doctor: { select: { name: true, doctorRegNo: true } },
    },
  })

  const doctorMap = new Map<string, DoctorRevenueRow>()
  for (const e of estimates) {
    if (!doctorMap.has(e.doctorId)) {
      doctorMap.set(e.doctorId, {
        doctorId: e.doctorId,
        doctorName: e.doctor.name,
        doctorRegNo: e.doctor.doctorRegNo,
        estimateCount: 0,
        estimateTotal: 0,
        patientCount: 0,
      })
    }
    const row = doctorMap.get(e.doctorId)!
    row.estimateCount++
    row.estimateTotal += Number(e.total)
  }

  // Count unique patients per doctor
  for (const [doctorId, row] of doctorMap.entries()) {
    const unique = new Set(estimates.filter((e) => e.doctorId === doctorId).map((e) => e.patientId))
    row.patientCount = unique.size
  }

  return Array.from(doctorMap.values()).sort((a, b) => b.estimateTotal - a.estimateTotal)
}
