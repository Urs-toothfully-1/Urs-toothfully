"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  retryWhatsAppMessageAction,
  retryAllFailedWhatsAppMessagesAction,
  cancelWhatsAppMessageAction,
  processWhatsAppQueueAction,
} from "@/actions/whatsapp"
import { BRAND_COLORS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { MessageStatusBadge } from "@/components/whatsapp/MessageStatusBadge"
import { SendMessageDialog, TemplateOption } from "@/components/whatsapp/SendMessageDialog"
import { toast } from "sonner"
import { Loader2, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react"

export interface QueueMessageRow {
  id: string
  patientName: string | null
  patientDisplayId: string | null
  toPhone: string
  templateName: string
  status: "PENDING" | "PROCESSING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RETRY" | "CANCELLED"
  triggerKey: string | null
  attemptCount: number
  maxAttempts: number
  scheduledFor: string
  failureReason: string | null
  createdAt: string
  createdByName: string | null
}

const FILTERS = ["ALL", "PENDING", "PROCESSING", "RETRY", "FAILED", "CANCELLED"] as const

interface Props {
  messages: QueueMessageRow[]
  total: number
  page: number
  pageSize: number
  statusFilter: string
  templates: TemplateOption[]
  isAdmin: boolean
  sendingEnabled: boolean
  queuePaused: boolean
}

export function QueueMgmt({ messages, total, page, pageSize, statusFilter, templates, isAdmin, sendingEnabled, queuePaused }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendOpen, setSendOpen] = useState(false)

  function run(fn: () => Promise<{ success?: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed")
      }
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      {(!sendingEnabled || queuePaused) && (
        <div className="p-3 rounded-lg border text-sm font-medium"
          style={!sendingEnabled
            ? { borderColor: "#FECACA", backgroundColor: "#FEF2F2", color: "#991B1B" }
            : { borderColor: "#FDE68A", backgroundColor: "#FFFBEB", color: "#92400E" }}>
          {!sendingEnabled
            ? "Emergency stop is active — messages stay queued and are not sent."
            : "Queue is paused — messages stay queued until an administrator resumes it."}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => router.push(f === "ALL" ? "/whatsapp/queue" : `/whatsapp/queue?status=${f}`)}
              className="px-3 h-9 rounded-md text-xs font-semibold transition-colors"
              style={
                statusFilter === f
                  ? { backgroundColor: BRAND_COLORS.sidebarActiveBg, color: BRAND_COLORS.primaryTeal }
                  : { color: BRAND_COLORS.sidebarMuted }
              }
            >
              {f === "ALL" ? "Active" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" disabled={isPending} onClick={() => run(() => processWhatsAppQueueAction())} className="h-9">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Process Now
          </Button>
          {isAdmin && (
            <Button variant="outline" disabled={isPending} onClick={() => run(() => retryAllFailedWhatsAppMessagesAction())} className="h-9">
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Retry All Failed
            </Button>
          )}
          <Button
            disabled={isPending}
            onClick={() => setSendOpen(true)}
            className="h-9 text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Send Message
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="p-0">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: BRAND_COLORS.sidebarMuted }}>
                The queue is empty — nothing waiting to be sent.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#E0E3E5]">
                  <TableHead className="text-xs">Patient</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Template</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Attempts</TableHead>
                  <TableHead className="text-xs">Queued</TableHead>
                  <TableHead className="text-xs">Failure Reason</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id} className="border-[#E0E3E5]">
                    <TableCell className="text-sm">
                      <span style={{ color: BRAND_COLORS.bodyText }}>{m.patientName ?? "—"}</span>
                      {m.patientDisplayId && (
                        <span className="block text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>{m.patientDisplayId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono" style={{ color: BRAND_COLORS.secondaryText }}>
                      +{m.toPhone}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>
                      {m.templateName}
                      {m.triggerKey && (
                        <span className="block text-[11px]" style={{ color: BRAND_COLORS.sidebarMuted }}>auto</span>
                      )}
                    </TableCell>
                    <TableCell><MessageStatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-sm" style={{ color: BRAND_COLORS.secondaryText }}>
                      {m.attemptCount}/{m.maxAttempts}
                    </TableCell>
                    <TableCell className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
                      {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={m.failureReason ?? ""} style={{ color: "#991B1B" }}>
                      {m.failureReason ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {(m.status === "FAILED" || m.status === "CANCELLED") && (
                          <button
                            onClick={() => run(() => retryWhatsAppMessageAction(m.id))}
                            disabled={isPending}
                            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40"
                            aria-label="Retry message"
                            title="Retry"
                          >
                            <RotateCcw className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                          </button>
                        )}
                        {(m.status === "PENDING" || m.status === "RETRY" || m.status === "PROCESSING") && (
                          <button
                            onClick={() => run(() => cancelWhatsAppMessageAction(m.id))}
                            disabled={isPending}
                            className="p-2 rounded hover:bg-red-50 disabled:opacity-40"
                            aria-label="Cancel message"
                            title="Cancel"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
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
            <Button
              variant="outline" size="sm" disabled={page <= 1 || isPending}
              onClick={() => router.push(`/whatsapp/queue?${statusFilter !== "ALL" ? `status=${statusFilter}&` : ""}page=${page - 1}`)}
            >
              Previous
            </Button>
            <Button
              variant="outline" size="sm" disabled={page >= totalPages || isPending}
              onClick={() => router.push(`/whatsapp/queue?${statusFilter !== "ALL" ? `status=${statusFilter}&` : ""}page=${page + 1}`)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Working…
        </div>
      )}

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} templates={templates} />
    </div>
  )
}
