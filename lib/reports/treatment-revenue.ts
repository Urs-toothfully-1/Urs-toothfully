import { prisma } from "@/lib/prisma"

export interface TreatmentCategoryRow {
  category: string
  itemCount: number
  totalRevenue: number
  percentOfTotal: number
}

export async function getTreatmentRevenue(
  fromDate: Date,
  toDate: Date,
  branchId?: string
): Promise<TreatmentCategoryRow[]> {
  const groups = await prisma.estimateItem.groupBy({
    by: ["category"],
    where: {
      estimate: {
        isDeleted: false,
        createdAt: { gte: fromDate, lte: toDate },
        ...(branchId && { branchId }),
      },
    },
    _sum: { amount: true },
    _count: true,
  })

  const grandTotal = groups.reduce((s, g) => s + Number(g._sum.amount ?? 0), 0)

  return groups
    .map((g) => ({
      category: g.category,
      itemCount: g._count,
      totalRevenue: Number(g._sum.amount ?? 0),
      percentOfTotal: grandTotal > 0 ? Math.round((Number(g._sum.amount ?? 0) / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}
