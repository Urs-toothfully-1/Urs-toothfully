import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { GroupDetail } from "@/components/whatsapp/GroupDetail"
import { whatsappGroupService } from "@/server/services/whatsapp/group.service"

export const metadata: Metadata = { title: "WhatsApp — Group" }
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ groupId: string }> }

export default async function WhatsAppGroupPage({ params }: Props) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  if (!session.perms.whatsapp) redirect("/reception")
  const { groupId } = await params

  const [group, log, templates] = await Promise.all([
    whatsappGroupService.get(groupId),
    whatsappGroupService.log(groupId),
    prisma.whatsAppTemplate.findMany({
      where: { status: "APPROVED", isEnabled: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, body: true, variables: true, category: true },
    }),
  ])
  if (!group) notFound()

  return (
    <div className="space-y-6">
      <WhatsAppNav role={session.role} />
      <GroupDetail
        group={{ id: group.id, name: group.name, description: group.description, createdBy: group.createdBy.name }}
        members={group.members.map((m) => ({ ...m, addedAt: m.addedAt.toISOString() }))}
        log={log.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null }))}
        templates={templates.map((t) => ({ ...t, variables: (t.variables as string[] | null) ?? [] }))}
        isAdmin={session.role === "ADMIN"}
      />
    </div>
  )
}
