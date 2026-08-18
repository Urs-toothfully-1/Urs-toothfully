import { prisma } from "@/lib/prisma"

export interface DailyRevenueRow {
  paymentType: string
  paymentMode: string
  count: number
  total: number
}

export interface DailySummary {
  date: string
  branchId?: string
  rows: DailyRevenueRow[]
  consultationTotal: number
  treatmentTotal: number
  advanceTotal: number
  adjustmentTotal: number
  productTotal: number
  grandTotal: number
  byCashTotal: number
  byUpiTotal: number
  byCardTotal: number
  byBankTotal: number
}

export async function getDailyRevenue(date: Date, branchId?: string): Promise<DailySummary> {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const groups = await prisma.accountingEntry.groupBy({
    by: ["paymentType", "paymentMode"],
    where: {
      isDeleted: false,
      entryDate: { gte: start, lte: end },
      ...(branchId && { branchId }),
    },
    _sum: { amount: true },
    _count: true,
  })

  const rows: DailyRevenueRow[] = groups.map((g) => ({
    paymentType: g.paymentType,
    paymentMode: g.paymentMode,
    count: g._count,
    total: Number(g._sum.amount ?? 0),
  }))

  const sum = (type?: string, mode?: string) =>
    rows
      .filter((r) => (!type || r.paymentType === type) && (!mode || r.paymentMode === mode))
      .reduce((s, r) => s + r.total, 0)

  return {
    date: start.toISOString().split("T")[0],
    branchId,
    rows,
    consultationTotal: sum("CONSULTATION"),
    treatmentTotal: sum("TREATMENT"),
    advanceTotal: sum("ADVANCE"),
    adjustmentTotal: sum("ADJUSTMENT"),
    productTotal: sum("PRODUCT"),
    grandTotal: sum(),
    byCashTotal: sum(undefined, "CASH"),
    byUpiTotal: sum(undefined, "UPI"),
    byCardTotal: sum(undefined, "CARD"),
    byBankTotal: sum(undefined, "BANK_TRANSFER"),
  }
}
