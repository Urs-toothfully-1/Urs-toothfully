import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { LogsTable, LogRow } from "@/components/whatsapp/LogsTable"
import type { WhatsAppMessageStatus } from "@prisma/client"

export const metadata: Metadata = { title: "WhatsApp — Message Logs" }
export const dynamic = "force-dynamic"

export default async function WhatsAppLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; page?: string }>
}) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  const sp = await searchParams

  const result = await whatsappMessageRepository.findMany({
    search: sp.q || undefined,
    status: sp.status && sp.status !== "ALL" ? (sp.status as WhatsAppMessageStatus) : undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined,
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    pageSize: 50,
  })

  const rows: LogRow[] = result.messages.map((m) => ({
    id: m.id,
    patientName: m.patient?.fullName ?? null,
    patientDisplayId: m.patient?.patientId ?? null,
    toPhone: m.toPhone,
    templateName: m.templateName,
    variables: (m.variables as string[] | null) ?? [],
    status: m.status,
    metaMessageId: m.metaMessageId,
    createdAt: m.createdAt.toISOString(),
    sentAt: m.sentAt?.toISOString() ?? null,
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
    readAt: m.readAt?.toISOString() ?? null,
    failureReason: m.failureReason,
    branchName: m.branch?.name ?? null,
    createdByName: m.createdBy?.name ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Full message audit log · search &amp; export
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      <LogsTable
        rows={rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        filters={{ q: sp.q ?? "", status: sp.status ?? "ALL", from: sp.from ?? "", to: sp.to ?? "" }}
      />
    </div>
  )
}
