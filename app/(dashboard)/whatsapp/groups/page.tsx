import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { BRAND_COLORS } from "@/lib/constants"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { GroupsList } from "@/components/whatsapp/GroupsList"
import { whatsappGroupService } from "@/server/services/whatsapp/group.service"

export const metadata: Metadata = { title: "WhatsApp — Groups" }
export const dynamic = "force-dynamic"

export default async function WhatsAppGroupsPage() {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  if (!session.perms.whatsapp) redirect("/reception")
  const groups = await whatsappGroupService.list()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>WhatsApp Management</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Groups · put patients in a group and send them any approved template (offers, camps, reminders)
        </p>
      </div>
      <WhatsAppNav role={session.role} />
      <GroupsList groups={groups.map((g) => ({ ...g, lastSentAt: g.lastSentAt?.toISOString() ?? null }))} />
    </div>
  )
}
