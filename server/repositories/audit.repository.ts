import { prisma } from "@/lib/prisma"
import { AuditAction } from "@prisma/client"

export const auditRepository = {
  async findAll(params: {
    entityType?: string
    action?: AuditAction
    changedById?: string
    fromDate?: Date
    toDate?: Date
    branchId?: string
    page?: number
    pageSize?: number
  }) {
    const {
      entityType, action, changedById, fromDate, toDate, branchId,
      page = 1, pageSize = 50,
    } = params

    const where = {
      ...(entityType && { entityType }),
      ...(action && { action }),
      ...(changedById && { changedById }),
      ...(branchId && { branchId }),
      ...(fromDate || toDate
        ? { changedAt: { ...(fromDate && { gte: fromDate }), ...(toDate && { lte: toDate }) } }
        : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { changedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { changedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return { logs, total, page, pageSize }
  },

  async findByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { changedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { changedAt: "desc" },
    })
  },

  async getEntityTypes(): Promise<string[]> {
    const result = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    })
    return result.map((r) => r.entityType)
  },
}
