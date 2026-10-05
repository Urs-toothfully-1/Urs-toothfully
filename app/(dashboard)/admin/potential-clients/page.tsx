import { Metadata } from "next"
import type { LeadStatus } from "@prisma/client"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { potentialClientService } from "@/server/services/potential-client.service"
import { PotentialClientsMgmt } from "@/components/admin/PotentialClientsMgmt"

export const metadata: Metadata = { title: "Potential Clients" }
export const dynamic = "force-dynamic"

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "CONVERTED", "NOT_INTERESTED"]

type Props = { searchParams: Promise<{ q?: string; status?: string; optin?: string; page?: string }> }

export default async function PotentialClientsPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const status = STATUSES.includes(sp.status as LeadStatus) ? (sp.status as LeadStatus) : undefined
  const optIn = sp.optin === "yes" ? true : sp.optin === "no" ? false : undefined

  const [data, templates] = await Promise.all([
    potentialClientService.list({ search: sp.q, status, optIn, page: Number(sp.page) || 1 }),
    prisma.whatsAppTemplate.findMany({
      where: { status: "APPROVED", isEnabled: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, body: true, variables: true, category: true },
    }),
  ])

  return (
    <PotentialClientsMgmt
      rows={data.rows.map((r) => ({
        id: r.id, fullName: r.fullName, mobile: r.mobile, email: r.email, area: r.area, source: r.source, notes: r.notes,
        whatsappOptIn: r.whatsappOptIn, status: r.status, messageCount: r.messageCount,
        lastMessagedAt: r.lastMessagedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
        patient: r.patient ? { id: r.patient.id, patientId: r.patient.patientId } : null,
      }))}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
      counts={data.counts}
      optedIn={data.optedIn}
      filters={{ q: sp.q ?? "", status: status ?? "", optin: sp.optin ?? "" }}
      templates={templates.map((t) => ({ id: t.id, displayName: t.displayName, body: t.body, category: t.category, variables: (t.variables as string[] | null) ?? [] }))}
    />
  )
}
