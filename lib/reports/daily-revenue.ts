import { prisma } from "@/lib/prisma"
import { istDayRange } from "@/lib/ist"

export interface DailyRevenueRow {
  paymentType: string
  paymentMode: string
  count: number
  total: number
}

/** A payment whose receipt date and entry date fall on different days. */
export interface DatedElsewhere {
  id: string
  patientName: string
  patientId: string
  paymentType: string
  paymentMode: string
  amount: number
  receiptDate: string // YYYY-MM-DD
  enteredOn: string // YYYY-MM-DD (IST)
}

/**
 * "receipt": by the receipt date written on the payment (the books — what
 *   Tally/accounting use; staff often back-date old paper receipts).
 * "entry": by the day it was entered in the system (what the desk actually
 *   collected / recorded that day — use this to tally the cash drawer).
 */
export type RevenueBasis = "receipt" | "entry"

export interface DailySummary {
  date: string
  basis: RevenueBasis
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
  /** Entered on this day but dated another day. */
  enteredTodayDatedElsewhere: DatedElsewhere[]
  /** Dated this day but entered on another day. */
  datedTodayEnteredElsewhere: DatedElsewhere[]
}

const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)

/** `date` is a calendar day (YYYY-MM-DD) in IST. */
export async function getDailyRevenue(date: string, branchId?: string, basis: RevenueBasis = "receipt"): Promise<DailySummary> {
  const { start, end } = istDayRange(date)
  const receiptDay = new Date(`${date}T00:00:00Z`) // AccountingEntry.entryDate is a @db.Date
  const branch = branchId ? { branchId } : {}

  const groups = await prisma.accountingEntry.groupBy({
    by: ["paymentType", "paymentMode"],
    where: {
      isDeleted: false,
      ...branch,
      ...(basis === "receipt"
        ? { entryDate: receiptDay }
        : { payment: { createdAt: { gte: start, lte: end } } }),
    },
    _sum: { amount: true },
    _count: true,
  })

  const rows: DailyRevenueRow[] = groups
    .map((g) => ({ paymentType: g.paymentType, paymentMode: g.paymentMode, count: g._count, total: Number(g._sum.amount ?? 0) }))
    .sort((a, b) => a.paymentType.localeCompare(b.paymentType) || a.paymentMode.localeCompare(b.paymentMode))

  const sum = (type?: string, mode?: string) =>
    rows.filter((r) => (!type || r.paymentType === type) && (!mode || r.paymentMode === mode)).reduce((s, r) => s + r.total, 0)

  // Both directions of "back-dated" for this day, so the two views can be reconciled.
  const mismatched = await prisma.accountingEntry.findMany({
    where: {
      isDeleted: false,
      ...branch,
      OR: [
        { payment: { createdAt: { gte: start, lte: end } }, NOT: { entryDate: receiptDay } },
        { entryDate: receiptDay, payment: { OR: [{ createdAt: { lt: start } }, { createdAt: { gt: end } }] } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, paymentType: true, paymentMode: true, amount: true, entryDate: true,
      payment: { select: { createdAt: true, patient: { select: { fullName: true, patientId: true } } } },
    },
  })
  const view = (e: (typeof mismatched)[number]): DatedElsewhere => ({
    id: e.id,
    patientName: e.payment.patient.fullName,
    patientId: e.payment.patient.patientId,
    paymentType: e.paymentType,
    paymentMode: e.paymentMode,
    amount: Number(e.amount),
    receiptDate: e.entryDate.toISOString().slice(0, 10),
    enteredOn: istDay(e.payment.createdAt),
  })
  const all = mismatched.map(view)

  return {
    date,
    basis,
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
    enteredTodayDatedElsewhere: all.filter((e) => e.enteredOn === date && e.receiptDate !== date),
    datedTodayEnteredElsewhere: all.filter((e) => e.receiptDate === date && e.enteredOn !== date),
  }
}
