import { prisma } from "@/lib/prisma"
import { LedgerCategory, LedgerDirection, PaymentMode, Prisma } from "@prisma/client"

export const LEDGER_PAGE_SIZE = 50

export interface LedgerFilters {
  branchId?: string
  category?: LedgerCategory
  fromDate: Date
  toDate: Date
}

export const ledgerRepository = {
  async create(data: {
    branchId: string
    entryDate: Date
    direction: LedgerDirection
    category: LedgerCategory
    amount: Prisma.Decimal
    paymentMode: PaymentMode
    payee?: string
    notes?: string
    attachmentData?: string
    createdById: string
  }) {
    return prisma.ledgerEntry.create({ data })
  },

  async findByBranch(filters: LedgerFilters, page = 1) {
    const where: Prisma.LedgerEntryWhereInput = {
      isDeleted: false,
      entryDate: { gte: filters.fromDate, lte: filters.toDate },
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.category ? { category: filters.category } : {}),
    }
    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        // attachmentData (a base64 image) is deliberately omitted from the list —
        // it's fetched only when a row's bill is opened, so the list stays light.
        // attachmentData (a base64 image) is deliberately omitted — it's fetched
        // only when a row's bill is opened, so the list stays light.
        select: {
          id: true, entryDate: true, direction: true, category: true, amount: true,
          paymentMode: true, payee: true, notes: true, createdAt: true,
          branch: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        take: LEDGER_PAGE_SIZE,
        skip: (Math.max(1, page) - 1) * LEDGER_PAGE_SIZE,
      }),
      prisma.ledgerEntry.count({ where }),
    ])

    // Which rows have a bill photo — filtered on NULL-ness so the (large) base64
    // is never shipped; only ids come back.
    const withBill = await prisma.ledgerEntry.findMany({
      where: { id: { in: entries.map((e) => e.id) }, NOT: { attachmentData: null } },
      select: { id: true },
    })
    const billIds = new Set(withBill.map((e) => e.id))
    return {
      entries: entries.map((e) => ({ ...e, hasAttachment: billIds.has(e.id) })),
      total,
    }
  },

  async findById(id: string) {
    return prisma.ledgerEntry.findFirst({ where: { id, isDeleted: false } })
  },

  /** Fetches just the bill image for one entry, on demand. */
  async getAttachment(id: string): Promise<string | null> {
    const row = await prisma.ledgerEntry.findFirst({
      where: { id, isDeleted: false },
      select: { attachmentData: true },
    })
    return row?.attachmentData ?? null
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    await prisma.ledgerEntry.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason },
    })
  },

  /**
   * Period totals for the Cash Book summary. Sales come from patient Payments
   * (the income the clinic already records); expenses/other-income come from the
   * ledger. All bounded aggregates — no rows shipped.
   */
  async summary(filters: LedgerFilters) {
    const branchClause = filters.branchId ? { branchId: filters.branchId } : {}

    const [salesAgg, ledgerGroups] = await Promise.all([
      prisma.payment.aggregate({
        where: { isDeleted: false, paymentDate: { gte: filters.fromDate, lte: filters.toDate }, ...branchClause },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["direction", "category"],
        where: { isDeleted: false, entryDate: { gte: filters.fromDate, lte: filters.toDate }, ...branchClause },
        _sum: { amount: true },
      }),
    ])

    const sales = Number(salesAgg._sum.amount ?? 0)
    let expenses = 0
    let otherIncome = 0
    const byCategory: Record<string, number> = {}
    for (const g of ledgerGroups) {
      const amt = Number(g._sum.amount ?? 0)
      if (g.direction === "OUT") {
        expenses += amt
        byCategory[g.category] = (byCategory[g.category] ?? 0) + amt
      } else {
        otherIncome += amt
      }
    }
    return { sales, otherIncome, expenses, net: sales + otherIncome - expenses, byCategory }
  },
}
