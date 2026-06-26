import { prisma } from "@/lib/prisma"

export interface LeadSourceRow {
  source: string
  count: number
  percentOfTotal: number
}

export async function getLeadSourceReport(
  fromDate: Date,
  toDate: Date
): Promise<LeadSourceRow[]> {
  const groups = await prisma.patient.groupBy({
    by: ["leadSource"],
    where: {
      isDeleted: false,
      createdAt: { gte: fromDate, lte: toDate },
    },
    _count: true,
  })

  const total = groups.reduce((s, g) => s + g._count, 0)

  return groups
    .map((g) => ({
      source: g.leadSource ?? "Unknown",
      count: g._count,
      percentOfTotal: total > 0 ? Math.round((g._count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}
