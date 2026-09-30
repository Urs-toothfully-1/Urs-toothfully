import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { whatsappInboxService } from "@/server/services/whatsapp/inbox.service"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { WhatsAppInbox } from "@/components/whatsapp/WhatsAppInbox"

export const metadata: Metadata = { title: "WhatsApp — Inbox" }
export const dynamic = "force-dynamic"

export default async function WhatsAppInboxPage() {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  const conversations = await whatsappInboxService.listConversations()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Inbox · read &amp; reply to patient conversations
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      <WhatsAppInbox initialConversations={conversations} />
    </div>
  )
}
