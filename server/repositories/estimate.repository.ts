import { prisma } from "@/lib/prisma"
import { EstimateStatus, ItemStatus, Prisma } from "@prisma/client"

export const estimateRepository = {
  async findById(id: string) {
    return prisma.estimate.findUnique({
      where: { id, isDeleted: false },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, mobile: true, email: true } },
        doctor: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: "asc" } },
        payments: {
          where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
          select: { id: true, amount: true, paymentType: true, paymentDate: true },
        },
      },
    })
  },

  async findByPatient(patientId: string) {
    return prisma.estimate.findMany({
      where: { patientId, isDeleted: false },
      include: {
        doctor: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: { select: { id: true, treatmentName: true, amount: true, status: true } },
        payments: {
          where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  },

  async findActiveByPatient(patientId: string) {
    return prisma.estimate.findMany({
      where: { patientId, isDeleted: false, status: "ACTIVE" },
      include: {
        items: { select: { treatmentName: true, amount: true } },
        payments: {
          where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  },

  async create(data: {
    estimateNo: string
    patientId: string
    branchId: string
    doctorId: string
    visitId: string
    subtotal: Prisma.Decimal
    total: Prisma.Decimal
    advanceRequired: Prisma.Decimal
    discountPercent?: Prisma.Decimal
    discountAmount?: Prisma.Decimal
    notes?: string
    items: Array<{
      treatmentId?: string
      treatmentName: string
      category: string
      toothNumber?: string
      quantity: number
      unitRate: Prisma.Decimal
      amount: Prisma.Decimal
      sortOrder: number
    }>
  }) {
    const { items, ...estimateData } = data
    return prisma.estimate.create({
      data: {
        ...estimateData,
        items: { create: items },
      },
      include: {
        items: true,
        doctor: { select: { id: true, name: true } },
      },
    })
  },

  async updateItemStatus(
    itemId: string,
    status: ItemStatus,
    updatedById: string
  ) {
    return prisma.estimateItem.update({
      where: { id: itemId },
      data: { status, statusUpdatedAt: new Date(), statusUpdatedById: updatedById },
    })
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    await prisma.estimate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        deletionReason,
        status: EstimateStatus.CANCELLED,
      },
    })
  },

  async getLatestEstimateNoForYear(year: number): Promise<string | null> {
    const result = await prisma.estimate.findFirst({
      where: { estimateNo: { startsWith: `EST-${year}-` } },
      orderBy: { estimateNo: "desc" },
      select: { estimateNo: true },
    })
    return result?.estimateNo ?? null
  },
}
