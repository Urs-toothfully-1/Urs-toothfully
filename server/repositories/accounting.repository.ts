import { prisma } from "@/lib/prisma"
import { AccountingStatus, PaymentType } from "@prisma/client"

export const accountingRepository = {
  async findByBranch(params: {
    branchId?: string
    fromDate?: Date
    toDate?: Date
    status?: AccountingStatus
    paymentType?: PaymentType
    page?: number
    pageSize?: number
  }) {
    const { branchId, fromDate, toDate, status, paymentType, page = 1, pageSize = 50 } = params

    const where = {
      isDeleted: false,
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(paymentType && { paymentType }),
      ...(fromDate || toDate
        ? { entryDate: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } }
        : {}),
    }

    const [entries, total] = await Promise.all([
      prisma.accountingEntry.findMany({
        where,
        include: {
          patient: { select: { id: true, patientId: true, fullName: true } },
          branch: { select: { id: true, name: true } },
          payment: {
            select: {
              id: true,
              mode: true,
              transactionRef: true,
              receipt: { select: { id: true, receiptNo: true } },
            },
          },
        },
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.accountingEntry.count({ where }),
    ])

    return { entries, total, page, pageSize }
  },

  async findById(id: string) {
    return prisma.accountingEntry.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true } },
        branch: { select: { name: true } },
        payment: {
          select: {
            mode: true,
            transactionRef: true,
            receipt: { select: { id: true, receiptNo: true } },
          },
        },
      },
    })
  },

  async updateNotes(id: string, notes: string): Promise<void> {
    await prisma.accountingEntry.update({ where: { id }, data: { notes } })
  },

  async approve(id: string): Promise<void> {
    await prisma.accountingEntry.update({
      where: { id },
      data: { status: AccountingStatus.APPROVED },
    })
  },

  async softDelete(id: string, deletedById: string, deletionReason: string): Promise<void> {
    await prisma.accountingEntry.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason },
    })
  },

  async findForExport(params: { branchId?: string; fromDate: Date; toDate: Date }) {
    return prisma.accountingEntry.findMany({
      where: {
        isDeleted: false,
        status: AccountingStatus.APPROVED,
        ...(params.branchId && { branchId: params.branchId }),
        entryDate: { gte: params.fromDate, lte: params.toDate },
      },
      include: {
        patient: { select: { patientId: true, fullName: true } },
        branch: { select: { name: true } },
        payment: { select: { transactionRef: true, receipt: { select: { receiptNo: true } } } },
      },
      orderBy: { entryDate: "asc" },
    })
  },

  async markExported(ids: string[], exportBatchId: string): Promise<void> {
    await prisma.accountingEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: AccountingStatus.EXPORTED, exportBatchId },
    })
  },

  async getDailySummary(branchId: string, date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.accountingEntry.groupBy({
      by: ["paymentType", "paymentMode"],
      where: {
        branchId,
        isDeleted: false,
        entryDate: { gte: start, lte: end },
        entryType: "RECEIPT",
      },
      _sum: { amount: true },
      _count: true,
    })
  },

  async getSummaryByType(params: { branchId?: string; fromDate: Date; toDate: Date }) {
    return prisma.accountingEntry.groupBy({
      by: ["paymentType"],
      where: {
        isDeleted: false,
        ...(params.branchId && { branchId: params.branchId }),
        entryDate: { gte: params.fromDate, lte: params.toDate },
      },
      _sum: { amount: true },
      _count: true,
    })
  },
}
