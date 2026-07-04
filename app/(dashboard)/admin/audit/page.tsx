import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { auditRepository } from "@/server/repositories/audit.repository"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "STATUS_CHANGE" | "CLAIM" | "COMPLETE"

export const metadata: Metadata = { title: "Audit Log" }
export const dynamic = "force-dynamic"

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: "#D1FAE5", color: "#065F46" },
  UPDATE: { bg: "#DBEAFE", color: "#1D4ED8" },
  DELETE: { bg: "#FEE2E2", color: "#B91C1C" },
  APPROVE: { bg: "#EDE9FE", color: "#6D28D9" },
  EXPORT: { bg: "#FEF3C7", color: "#B45309" },
  STATUS_CHANGE: { bg: "#DBEAFE", color: "#1D4ED8" },
  CLAIM: { bg: "#D1FAE5", color: "#065F46" },
  COMPLETE: { bg: "#D1FAE5", color: "#065F46" },
}

type Props = {
  searchParams: Promise<{
    entityType?: string; action?: string; userId?: string
    from?: string; to?: string; page?: string
  }>
}

const PAGE_SIZE = 50

export default async function AuditLogPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams

  const today = new Date().toISOString().split("T")[0]
  const page = parseInt(sp.page ?? "1")

  const [result, entityTypes, users] = await Promise.all([
    auditRepository.findAll({
      entityType: sp.entityType || undefined,
      action: (sp.action as AuditAction) || undefined,
      changedById: sp.userId || undefined,
      fromDate: sp.from ? new Date(sp.from) : undefined,
      toDate: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    auditRepository.getEntityTypes(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])

  const { logs, total } = result
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams({
      entityType: sp.entityType ?? "", action: sp.action ?? "",
      userId: sp.userId ?? "", from: sp.from ?? "", to: sp.to ?? "",
      page: "1", ...updates,
    })
    return `/admin/audit?${params.toString()}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
            Audit Log
          </h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {total} records · immutable — tracks all system changes
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="p-4">
          <form method="GET" action="/admin/audit" className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Entity</label>
              <select name="entityType" defaultValue={sp.entityType ?? ""}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="">All Entities</option>
                {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Action</label>
              <select name="action" defaultValue={sp.action ?? ""}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="">All Actions</option>
                {["CREATE","UPDATE","DELETE","APPROVE","EXPORT","STATUS_CHANGE","CLAIM","COMPLETE"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>User</label>
              <select name="userId" defaultValue={sp.userId ?? ""}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="">All Users</option>
                {users.map((u: { id: string; name: string; role: string }) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>From</label>
              <input type="date" name="from" defaultValue={sp.from ?? ""}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>To</label>
              <input type="date" name="to" defaultValue={sp.to ?? ""} max={today}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm" />
            </div>
            <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              Filter
            </button>
            <Link href="/admin/audit"
              className="h-9 px-4 rounded text-sm font-medium flex items-center border border-[#E0E3E5]"
              style={{ color: BRAND_COLORS.bodyText }}>
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Audit log table */}
      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <Shield className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Audit Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Shield className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                    {["When", "Entity", "Entity ID", "Action", "By", "Summary"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                        style={{ color: BRAND_COLORS.borderDivider }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: { id: string; action: string; entityType: string; entityId: string; changedAt: Date | string; changedBy: { name: string; role: string }; newValues: unknown; reason?: string | null }) => {
                    const actionStyle = ACTION_STYLE[log.action] ?? { bg: "#F3F4F6", color: "#6B7280" }
                    const changes = log.newValues
                      ? Object.entries(log.newValues as Record<string, unknown>)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")
                      : log.reason ?? "—"

                    return (
                      <tr key={log.id} className="border-b hover:bg-gray-50"
                        style={{ borderColor: BRAND_COLORS.lightBackground }}>
                        <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                          {formatDate(log.changedAt)}
                          <p className="text-xs opacity-70">
                            {new Date(log.changedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                            {log.entityType}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color: BRAND_COLORS.borderDivider }}>
                          {log.entityId.slice(0, 8)}…
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ backgroundColor: actionStyle.bg, color: actionStyle.color }}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                          {log.changedBy.name}
                          <p className="text-xs opacity-60">{log.changedBy.role}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs max-w-[200px] truncate"
                          style={{ color: BRAND_COLORS.borderDivider }}>
                          {changes}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: BRAND_COLORS.borderDivider }}>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E0E3E5]"
                style={{ color: BRAND_COLORS.bodyText }}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E0E3E5]"
                style={{ color: BRAND_COLORS.bodyText }}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
