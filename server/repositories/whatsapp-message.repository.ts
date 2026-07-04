import { prisma } from "@/lib/prisma"
import { Prisma, WhatsAppMessageStatus } from "@prisma/client"

export interface MessageListFilters {
  status?: WhatsAppMessageStatus
  statuses?: WhatsAppMessageStatus[]
  search?: string // patient name / phone / template name
  branchId?: string
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

const ACTIVE_QUEUE_STATUSES: WhatsAppMessageStatus[] = ["PENDING", "PROCESSING", "RETRY"]

function buildWhere(filters: MessageListFilters): Prisma.WhatsAppMessageWhereInput {
  const where: Prisma.WhatsAppMessageWhereInput = {}
  if (filters.status) where.status = filters.status
  if (filters.statuses?.length) where.status = { in: filters.statuses }
  if (filters.branchId) where.branchId = filters.branchId
  if (filters.from || filters.to) {
    where.createdAt = { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) }
  }
  if (filters.search) {
    where.OR = [
      { toPhone: { contains: filters.search } },
      { templateName: { contains: filters.search, mode: "insensitive" } },
      { patient: { fullName: { contains: filters.search, mode: "insensitive" } } },
      { patient: { patientId: { contains: filters.search, mode: "insensitive" } } },
    ]
  }
  return where
}

export const whatsappMessageRepository = {
  async findMany(filters: MessageListFilters = {}) {
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? 50
    const where = buildWhere(filters)

    const [messages, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where,
        include: {
          patient: { select: { id: true, patientId: true, fullName: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.whatsAppMessage.count({ where }),
    ])
    return { messages, total, page, pageSize }
  },

  async findById(id: string) {
    return prisma.whatsAppMessage.findUnique({
      where: { id },
      include: { patient: { select: { id: true, patientId: true, fullName: true } } },
    })
  },

  async create(data: Prisma.WhatsAppMessageUncheckedCreateInput) {
    return prisma.whatsAppMessage.create({ data })
  },

  /**
   * Atomically claims the next due message for sending (PENDING or RETRY whose
   * scheduledFor has passed). updateMany guards against concurrent processors.
   */
  async claimNextDue() {
    const candidate = await prisma.whatsAppMessage.findFirst({
      where: { status: { in: ["PENDING", "RETRY"] }, scheduledFor: { lte: new Date() } },
      orderBy: { scheduledFor: "asc" },
      select: { id: true },
    })
    if (!candidate) return null

    const claimed = await prisma.whatsAppMessage.updateMany({
      where: { id: candidate.id, status: { in: ["PENDING", "RETRY"] } },
      data: { status: "PROCESSING", processingAt: new Date(), attemptCount: { increment: 1 } },
    })
    if (claimed.count === 0) return null

    return prisma.whatsAppMessage.findUnique({
      where: { id: candidate.id },
      include: { template: true, patient: { select: { fullName: true, patientId: true } } },
    })
  },

  async markSent(id: string, metaMessageId: string) {
    return prisma.whatsAppMessage.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), metaMessageId, failureReason: null },
    })
  },

  async markFailed(id: string, reason: string, willRetry: boolean, retryAt?: Date) {
    return prisma.whatsAppMessage.update({
      where: { id },
      data: willRetry
        ? { status: "RETRY", failureReason: reason, scheduledFor: retryAt ?? new Date() }
        : { status: "FAILED", failedAt: new Date(), failureReason: reason },
    })
  },

  async updateStatusByMetaId(
    metaMessageId: string,
    status: Extract<WhatsAppMessageStatus, "SENT" | "DELIVERED" | "READ" | "FAILED">,
    at: Date,
    failureReason?: string
  ) {
    const data: Prisma.WhatsAppMessageUpdateInput =
      status === "DELIVERED" ? { status, deliveredAt: at }
      : status === "READ" ? { status, readAt: at }
      : status === "FAILED" ? { status, failedAt: at, failureReason }
      : { status, sentAt: at }

    // READ implies DELIVERED — never regress a READ back to DELIVERED/SENT
    const regressGuard: Prisma.WhatsAppMessageWhereInput =
      status === "SENT" ? { status: { in: ["SENT", "PROCESSING", "PENDING", "RETRY"] } }
      : status === "DELIVERED" ? { status: { notIn: ["READ", "FAILED", "CANCELLED"] } }
      : {}

    return prisma.whatsAppMessage.updateMany({
      where: { metaMessageId, ...regressGuard },
      data,
    })
  },

  async requeue(id: string) {
    return prisma.whatsAppMessage.updateMany({
      where: { id, status: { in: ["FAILED", "CANCELLED", "RETRY"] } },
      data: { status: "PENDING", scheduledFor: new Date(), failureReason: null, failedAt: null, cancelledAt: null },
    })
  },

  async requeueAllFailed() {
    return prisma.whatsAppMessage.updateMany({
      where: { status: "FAILED" },
      data: { status: "PENDING", scheduledFor: new Date(), failureReason: null, failedAt: null },
    })
  },

  async cancel(id: string) {
    return prisma.whatsAppMessage.updateMany({
      where: { id, status: { in: ACTIVE_QUEUE_STATUSES } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    })
  },

  async countSentSince(since: Date) {
    return prisma.whatsAppMessage.count({
      where: { sentAt: { gte: since } },
    })
  },

  async countQueued() {
    return prisma.whatsAppMessage.count({ where: { status: { in: ACTIVE_QUEUE_STATUSES } } })
  },

  /** Dashboard aggregates for a period. */
  async statsBetween(from: Date, to: Date) {
    const grouped = await prisma.whatsAppMessage.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    })
    const byStatus: Record<string, number> = {}
    for (const g of grouped) byStatus[g.status] = g._count._all
    return byStatus
  },

  async categoryCountsBetween(from: Date, to: Date) {
    const grouped = await prisma.whatsAppMessage.groupBy({
      by: ["templateId"],
      where: { createdAt: { gte: from, lte: to }, templateId: { not: null } },
      _count: { _all: true },
    })
    return grouped
  },

  async avgDeliverySeconds(from: Date, to: Date): Promise<number | null> {
    const rows = await prisma.whatsAppMessage.findMany({
      where: { sentAt: { gte: from, lte: to }, deliveredAt: { not: null } },
      select: { sentAt: true, deliveredAt: true },
      take: 500,
      orderBy: { sentAt: "desc" },
    })
    if (rows.length === 0) return null
    const totalMs = rows.reduce((s, r) => s + (r.deliveredAt!.getTime() - r.sentAt!.getTime()), 0)
    return Math.round(totalMs / rows.length / 1000)
  },

  async topTemplates(from: Date, to: Date, failedOnly = false, limit = 5) {
    const grouped = await prisma.whatsAppMessage.groupBy({
      by: ["templateName"],
      where: { createdAt: { gte: from, lte: to }, ...(failedOnly && { status: "FAILED" as const }) },
      _count: { _all: true },
      orderBy: { _count: { templateName: "desc" } },
      take: limit,
    })
    return grouped.map((g) => ({ templateName: g.templateName, count: g._count._all }))
  },

  async countByBranch(from: Date, to: Date) {
    const grouped = await prisma.whatsAppMessage.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    })
    return grouped
  },

  async countByCreator(from: Date, to: Date) {
    const grouped = await prisma.whatsAppMessage.groupBy({
      by: ["createdById"],
      where: { createdAt: { gte: from, lte: to }, createdById: { not: null } },
      _count: { _all: true },
    })
    return grouped
  },

  /** Full export (no pagination) for CSV download. */
  async findAllForExport(filters: MessageListFilters = {}) {
    return prisma.whatsAppMessage.findMany({
      where: buildWhere(filters),
      include: {
        patient: { select: { patientId: true, fullName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    })
  },
}
