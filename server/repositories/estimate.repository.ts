import { prisma } from "@/lib/prisma"
import { EstimateStatus, ItemStatus, Prisma } from "@prisma/client"

export const estimateRepository = {
  async findById(id: string) {
    return prisma.estimate.findUnique({
      where: { id, isDeleted: false },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, mobile: true, email: true } },
        doctor: { select: { id: true, name: true, signatureData: true } },
        branch: { select: { id: true, name: true } },
        visit: { select: { id: true, visitNo: true } },
        items: { orderBy: { sortOrder: "asc" } },
        payments: {
          where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
          select: { id: true, amount: true, paymentType: true, paymentDate: true },
        },
      },
    })
  },

  async findByVisit(visitId: string) {
    return prisma.estimate.findFirst({
      where: { visitId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, estimateNo: true },
    })
  },

  async findByPatient(patientId: string) {
    return prisma.estimate.findMany({
      where: { patientId, isDeleted: false },
      include: {
        doctor: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        items: {
          select: {
            id: true, treatmentName: true, amount: true, status: true,
            category: true, toothNumber: true, quantity: true, unitRate: true,
            plannedSittings: true, completedSittings: true, isAlternative: true,
            statusUpdatedAt: true,
            statusUpdatedBy: { select: { name: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
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
      plannedSittings?: number
      /** Quoted as an option; printed but excluded from the total. */
      isAlternative?: boolean
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

  async findPendingItemsByPatients(patientIds: string[]) {
    if (!patientIds.length) return []
    return prisma.estimateItem.findMany({
      where: {
        estimate: { patientId: { in: patientIds }, isDeleted: false, status: "ACTIVE" },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        treatmentName: true,
        toothNumber: true,
        status: true,
        plannedSittings: true,
        completedSittings: true,
        estimate: { select: { patientId: true, id: true } },
      },
      orderBy: { sortOrder: "asc" },
    })
  },

  async update(
    id: string,
    data: {
      subtotal: Prisma.Decimal
      total: Prisma.Decimal
      advanceRequired: Prisma.Decimal
      discountPercent?: Prisma.Decimal | null
      discountAmount?: Prisma.Decimal | null
      notes?: string | null
      items: Array<{
        id?: string
        treatmentId?: string
        treatmentName: string
        category: string
        toothNumber?: string
        quantity: number
        unitRate: Prisma.Decimal
        amount: Prisma.Decimal
        plannedSittings?: number
        /** Quoted as an option; printed but excluded from the total. */
        isAlternative?: boolean
        sortOrder: number
      }>
    }
  ) {
    const { items, ...estimateData } = data
    return prisma.$transaction(async (tx) => {
      // Reconcile items by id so treatment progress (completedSittings, status)
      // is preserved when the estimate is edited after treatment has begun.
      const existing = await tx.estimateItem.findMany({
        where: { estimateId: id },
        select: { id: true },
      })
      const existingIds = new Set(existing.map((e) => e.id))
      const keepIds = items
        .map((i) => i.id)
        .filter((iid): iid is string => !!iid && existingIds.has(iid))

      // Delete items removed by the doctor
      await tx.estimateItem.deleteMany({
        where: { estimateId: id, id: { notIn: keepIds.length ? keepIds : ["__none__"] } },
      })

      // Update kept items in place; create new ones
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx]
        const common = {
          treatmentId: it.treatmentId,
          treatmentName: it.treatmentName,
          category: it.category,
          toothNumber: it.toothNumber,
          quantity: it.quantity,
          unitRate: it.unitRate,
          amount: it.amount,
          plannedSittings: it.plannedSittings ?? 1,
          isAlternative: it.isAlternative ?? false,
          sortOrder: idx,
        }
        if (it.id && existingIds.has(it.id)) {
          await tx.estimateItem.update({ where: { id: it.id }, data: common })
        } else {
          await tx.estimateItem.create({ data: { estimateId: id, ...common } })
        }
      }

      return tx.estimate.update({
        where: { id },
        data: estimateData,
        include: { items: { orderBy: { sortOrder: "asc" } }, doctor: { select: { id: true, name: true } } },
      })
    })
  },

  /**
   * Rewrites only the money fields. Used when the discount is changed from the
   * payment plan, where the treatment rows themselves are not being edited — so
   * the item reconcile in update() (and the treatment progress it preserves) is
   * left well alone.
   */
  async updateTotals(
    id: string,
    data: {
      subtotal: Prisma.Decimal
      total: Prisma.Decimal
      advanceRequired: Prisma.Decimal
      discountPercent: Prisma.Decimal | null
      discountAmount: Prisma.Decimal | null
    }
  ) {
    return prisma.estimate.update({ where: { id }, data })
  },

  /** Creates an empty ACTIVE estimate for a visit (prescription-first flow). Reuses an existing one. */
  async createEmpty(data: {
    estimateNo: string
    patientId: string
    branchId: string
    doctorId: string
    visitId: string
  }) {
    return prisma.estimate.create({
      data: {
        ...data,
        subtotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        advanceRequired: new Prisma.Decimal(0),
      },
      include: { items: true },
    })
  },

  /** Targeted per-item update for the treatment phase — does not rebuild the estimate. */
  async updateItemSittings(
    itemId: string,
    data: { plannedSittings?: number; completedSittings?: number; status?: ItemStatus; updatedById: string }
  ) {
    const { updatedById, ...rest } = data
    return prisma.estimateItem.update({
      where: { id: itemId },
      data: {
        ...rest,
        statusUpdatedAt: new Date(),
        statusUpdatedById: updatedById,
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
