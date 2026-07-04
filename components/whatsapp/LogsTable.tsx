"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { MessageStatusBadge } from "@/components/whatsapp/MessageStatusBadge"
import { Download, Search } from "lucide-react"

export interface LogRow {
  id: string
  patientName: string | null
  patientDisplayId: string | null
  toPhone: string
  templateName: string
  variables: string[]
  status: string
  metaMessageId: string | null
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failureReason: string | null
  branchName: string | null
  createdByName: string | null
}

const STATUS_FILTERS = ["ALL", "SENT", "DELIVERED", "READ", "FAILED", "PENDING", "CANCELLED"] as const

interface Props {
  rows: LogRow[]
  total: number
  page: number
  pageSize: number
  filters: { q: string; status: string; from: string; to: string }
}

function fmt(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function LogsTable({ rows, total, page, pageSize, filters }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(filters.q)
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)

  function buildQuery(overrides: Record<string, string> = {}): string {
    const params = new URLSearchParams()
    const merged = { q, status: filters.status, from, to, ...overrides }
    if (merged.q) params.set("q", merged.q)
    if (merged.status && merged.status !== "ALL") params.set("status", merged.status)
    if (merged.from) params.set("from", merged.from)
    if (merged.to) params.set("to", merged.to)
    if (overrides.page) params.set("page", overrides.page)
    return params.toString()
  }

  function applyFilters(overrides: Record<string, string> = {}) {
    router.push(`/whatsapp/logs?${buildQuery(overrides)}`)
  }

  const csvUrl = `/api/whatsapp/logs?${buildQuery()}${buildQuery() ? "&" : ""}format=csv`
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <label className="block text-xs font-medium mb-1" style={{ color: BRAND_COLORS.secondaryText }}>Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: BRAND_COLORS.sidebarMuted }} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Patient, phone or template…"
              className="pl-9 border-[#E0E3E5] bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: BRAND_COLORS.secondaryText }}>From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-[#E0E3E5] bg-white w-40" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: BRAND_COLORS.secondaryText }}>To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-[#E0E3E5] bg-white w-40" />
        </div>
        <Button onClick={() => applyFilters()} className="h-9 text-white" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
          Apply
        </Button>
        <a href={csvUrl} download>
          <Button variant="outline" className="h-9">
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </a>
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => applyFilters({ status: s })}
            className="px-3 h-8 rounded-md text-xs font-semibold transition-colors"
            style={
              filters.status === s || (s === "ALL" && !filters.status)
                ? { backgroundColor: BRAND_COLORS.sidebarActiveBg, color: BRAND_COLORS.primaryTeal }
                : { color: BRAND_COLORS.sidebarMuted }
            }
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: BRAND_COLORS.sidebarMuted }}>
                No messages match your filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#E0E3E5]">
                  <TableHead className="text-xs">Patient</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Template</TableHead>
                  <TableHead className="text-xs">Variables</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Queued</TableHead>
                  <TableHead className="text-xs">Delivered</TableHead>
                  <TableHead className="text-xs">Read</TableHead>
                  <TableHead className="text-xs">Failure Reason</TableHead>
                  <TableHead className="text-xs">Message ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id} className="border-[#E0E3E5]">
                    <TableCell className="text-sm">
                      <span style={{ color: BRAND_COLORS.bodyText }}>{m.patientName ?? "—"}</span>
                      {m.patientDisplayId && (
                        <span className="block text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{m.patientDisplayId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono" style={{ color: BRAND_COLORS.secondaryText }}>+{m.toPhone}</TableCell>
                    <TableCell className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>{m.templateName}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={m.variables.join(", ")} style={{ color: BRAND_COLORS.sidebarMuted }}>
                      {m.variables.join(", ") || "—"}
                    </TableCell>
                    <TableCell><MessageStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: BRAND_COLORS.sidebarMuted }}>{fmt(m.createdAt)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: BRAND_COLORS.sidebarMuted }}>{fmt(m.deliveredAt)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap" style={{ color: BRAND_COLORS.sidebarMuted }}>{fmt(m.readAt)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={m.failureReason ?? ""} style={{ color: "#991B1B" }}>
                      {m.failureReason ?? ""}
                    </TableCell>
                    <TableCell className="text-[11px] font-mono max-w-[140px] truncate" title={m.metaMessageId ?? ""} style={{ color: BRAND_COLORS.sidebarMuted }}>
                      {m.metaMessageId ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: BRAND_COLORS.sidebarMuted }}>
          <span>Page {page} of {totalPages} · {total} messages</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => applyFilters({ page: String(page - 1) })}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => applyFilters({ page: String(page + 1) })}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
