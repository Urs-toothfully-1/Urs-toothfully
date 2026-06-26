import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// Will be replaced by Prisma enum once schema is migrated in Milestone 2
type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "EXPORT"
  | "STATUS_CHANGE"
  | "CLAIM"
  | "COMPLETE"

interface AuditParams {
  entityType: string
  entityId: string
  action: AuditAction
  changedById: string
  previousValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  reason?: string
  branchId?: string
  ipAddress?: string
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changedById: params.changedById,
      previousValues: (params.previousValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: (params.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      reason: params.reason,
      branchId: params.branchId,
      ipAddress: params.ipAddress,
    },
  })
}
