import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { WhatsAppSettingsForm } from "@/components/whatsapp/SettingsForm"

export const metadata: Metadata = { title: "WhatsApp — API Settings" }
export const dynamic = "force-dynamic"

export default async function WhatsAppSettingsPage() {
  // ADMIN only — access tokens must never be exposed to receptionists
  const session = await requireRole(["ADMIN"])
  const settings = await whatsappService.getSettingsForAdmin()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const webhookUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/api/whatsapp/webhook` : "/api/whatsapp/webhook"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Meta Cloud API credentials &amp; sending limits
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      <WhatsAppSettingsForm
        settings={
          settings
            ? { ...settings, lastSyncAt: settings.lastSyncAt ? settings.lastSyncAt.toISOString() : null }
            : null
        }
        webhookUrl={webhookUrl}
      />
    </div>
  )
}
