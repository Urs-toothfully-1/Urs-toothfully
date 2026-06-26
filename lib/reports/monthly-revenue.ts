import { prisma } from "@/lib/prisma"

export interface MonthlyDayRow {
  date: string
  consultation: number
  treatment: number
  advance: number
  total: number
}

export interface MonthlyRevenueSummary {
  year: number
  month: number
  branchId?: string
  daily: MonthlyDayRow[]
  consultationTotal: number
  treatmentTotal: number
  advanceTotal: number
  grandTotal: number
}

export async function getMonthlyRevenue(
  year: number,
  month: number,
  branchId?: string
): Promise<MonthlyRevenueSummary> {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 0, 23, 59, 59)

  const groups = await prisma.accountingEntry.groupBy({
    by: ["entryDate", "paymentType"],
    where: {
      isDeleted: false,
      entryDate: { gte: from, lte: to },
      ...(branchId && { branchId }),
    },
    _sum: { amount: true },
    orderBy: { entryDate: "asc" },
  })

  // Build day map
  const dayMap = new Map<string, MonthlyDayRow>()
  for (const g of groups) {
    const date = g.entryDate.toISOString().split("T")[0]
    if (!dayMap.has(date)) {
      dayMap.set(date, { date, consultation: 0, treatment: 0, advance: 0, total: 0 })
    }
    const row = dayMap.get(date)!
    const amount = Number(g._sum.amount ?? 0)
    row.total += amount
    if (g.paymentType === "CONSULTATION") row.consultation += amount
    else if (g.paymentType === "TREATMENT") row.treatment += amount
    else if (g.paymentType === "ADVANCE") row.advance += amount
  }

  const daily = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    year,
    month,
    branchId,
    daily,
    consultationTotal: daily.reduce((s, d) => s + d.consultation, 0),
    treatmentTotal: daily.reduce((s, d) => s + d.treatment, 0),
    advanceTotal: daily.reduce((s, d) => s + d.advance, 0),
    grandTotal: daily.reduce((s, d) => s + d.total, 0),
  }
}
