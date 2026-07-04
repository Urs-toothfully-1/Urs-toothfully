import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { templateService } from "@/server/services/whatsapp/template.service"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { TemplatesMgmt, TemplateRow } from "@/components/whatsapp/TemplatesMgmt"

export const metadata: Metadata = { title: "WhatsApp — Templates" }
export const dynamic = "force-dynamic"

export default async function WhatsAppTemplatesPage() {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])

  // Seed the 20 default utility templates on first visit (idempotent)
  if (session.role === "ADMIN") {
    await templateService.ensureDefaults(session.userId).catch(() => null)
  }

  const templates = await templateService.list()
  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    displayName: t.displayName,
    category: t.category,
    language: t.language,
    status: t.status,
    isEnabled: t.isEnabled,
    headerText: t.headerText,
    body: t.body,
    footerText: t.footerText,
    variables: (t.variables as string[] | null) ?? [],
    metaTemplateId: t.metaTemplateId,
    triggerKey: t.triggerKey,
    isSystem: t.isSystem,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Message templates · create, edit, sync with Meta
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      <TemplatesMgmt templates={rows} isAdmin={session.role === "ADMIN"} />
    </div>
  )
}
