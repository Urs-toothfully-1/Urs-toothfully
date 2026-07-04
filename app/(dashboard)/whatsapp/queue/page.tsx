import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { templateService } from "@/server/services/whatsapp/template.service"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { QueueMgmt, QueueMessageRow } from "@/components/whatsapp/QueueMgmt"

export const metadata: Metadata = { title: "WhatsApp — Queue" }
export const dynamic = "force-dynamic"

export default async function WhatsAppQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  const sp = await searchParams

  const statusFilter = sp.status && sp.status !== "ALL" ? sp.status : undefined
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1

  const [result, templates, settings] = await Promise.all([
    whatsappMessageRepository.findMany({
      status: statusFilter as QueueMessageRow["status"] | undefined,
      statuses: statusFilter ? undefined : ["PENDING", "PROCESSING", "RETRY", "FAILED"],
      page,
      pageSize: 50,
    }),
    templateService.list({ enabledOnly: true }),
    whatsappSettingsRepository.get(),
  ])

  const rows: QueueMessageRow[] = result.messages.map((m) => ({
    id: m.id,
    patientName: m.patient?.fullName ?? null,
    patientDisplayId: m.patient?.patientId ?? null,
    toPhone: m.toPhone,
    templateName: m.templateName,
    status: m.status,
    triggerKey: m.triggerKey,
    attemptCount: m.attemptCount,
    maxAttempts: m.maxAttempts,
    scheduledFor: m.scheduledFor.toISOString(),
    failureReason: m.failureReason,
    createdAt: m.createdAt.toISOString(),
    createdByName: m.createdBy?.name ?? null,
  }))

  const templateOptions = templates
    .filter((t) => t.status === "APPROVED" || t.status === "DRAFT" || t.status === "PENDING")
    .map((t) => ({
      id: t.id,
      displayName: t.displayName,
      status: t.status,
      body: t.body,
      variables: (t.variables as string[] | null) ?? [],
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Message queue · pending, retrying and failed messages
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      <QueueMgmt
        messages={rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        statusFilter={sp.status ?? "ALL"}
        templates={templateOptions}
        isAdmin={session.role === "ADMIN"}
        sendingEnabled={settings?.sendingEnabled ?? true}
        queuePaused={settings?.queuePaused ?? false}
      />
    </div>
  )
}
