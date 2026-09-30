import { prisma } from "@/lib/prisma"

/**
 * WhatsApp inbox: builds staff-facing conversation views from the WhatsAppInbound
 * log (inbound patient messages + outbound free-form replies) merged with
 * WhatsAppMessage template sends. Used by the Admin/Reception Inbox page.
 */

export interface ConversationSummary {
  phone: string
  patientId: string | null
  patientName: string | null
  lastText: string | null
  lastDirection: string // IN | OUT
  lastAt: string // ISO
  unreadForStaff: number // needsStaff && !handledByStaff
}

export interface ThreadMessage {
  id: string
  direction: "IN" | "OUT"
  kind: "text" | "template"
  body: string
  at: string // ISO
  meta?: string // e.g. template name / status / bot
}

async function namesForPatientIds(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  if (uniq.length === 0) return new Map()
  const rows = await prisma.patient.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true } })
  return new Map(rows.map((r) => [r.id, r.fullName]))
}

export const whatsappInboxService = {
  /** Latest message per phone, newest conversation first. */
  async listConversations(): Promise<ConversationSummary[]> {
    // Fetch a recent window and fold to one row per phone in JS — clinic inbound
    // volume is modest, so this avoids DISTINCT ON raw SQL.
    const recent = await prisma.whatsAppInbound.findMany({
      orderBy: { receivedAt: "desc" },
      take: 800,
      select: { fromPhone: true, text: true, direction: true, receivedAt: true, patientId: true, needsStaff: true, handledByStaff: true },
    })

    const byPhone = new Map<string, ConversationSummary>()
    const unread = new Map<string, number>()
    for (const r of recent) {
      if (r.needsStaff && !r.handledByStaff) unread.set(r.fromPhone, (unread.get(r.fromPhone) ?? 0) + 1)
      if (!byPhone.has(r.fromPhone)) {
        byPhone.set(r.fromPhone, {
          phone: r.fromPhone,
          patientId: r.patientId,
          patientName: null,
          lastText: r.text,
          lastDirection: r.direction,
          lastAt: r.receivedAt.toISOString(),
          unreadForStaff: 0,
        })
      }
    }

    const names = await namesForPatientIds([...byPhone.values()].map((c) => c.patientId ?? "").filter(Boolean))
    const list = [...byPhone.values()].map((c) => ({
      ...c,
      patientName: c.patientId ? names.get(c.patientId) ?? null : null,
      unreadForStaff: unread.get(c.phone) ?? 0,
    }))
    list.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    return list
  },

  /** Full chronological thread for one phone (inbound + outbound + template sends). */
  async getThread(phone: string): Promise<ThreadMessage[]> {
    const [conv, templates] = await Promise.all([
      prisma.whatsAppInbound.findMany({
        where: { fromPhone: phone },
        orderBy: { receivedAt: "asc" },
        select: { id: true, direction: true, text: true, receivedAt: true, botAction: true },
      }),
      prisma.whatsAppMessage.findMany({
        where: { toPhone: phone },
        orderBy: { createdAt: "asc" },
        select: { id: true, templateName: true, variables: true, status: true, createdAt: true },
      }),
    ])

    const out: ThreadMessage[] = []
    for (const c of conv) {
      out.push({
        id: c.id,
        direction: c.direction === "OUT" ? "OUT" : "IN",
        kind: "text",
        body: c.text ?? "",
        at: c.receivedAt.toISOString(),
        meta: c.botAction ?? undefined,
      })
    }
    for (const t of templates) {
      const vars = (t.variables as string[] | null) ?? []
      out.push({
        id: t.id,
        direction: "OUT",
        kind: "template",
        body: `📄 ${t.templateName}${vars.length ? ` — ${vars.join(" · ")}` : ""}`,
        at: t.createdAt.toISOString(),
        meta: t.status,
      })
    }
    out.sort((a, b) => (a.at < b.at ? -1 : 1))
    return out
  },

  /** Records an outbound free-form reply (staff or bot) into the conversation log. */
  async logOutbound(input: { phone: string; text: string; sentById?: string; botAction?: string; patientId?: string }) {
    return prisma.whatsAppInbound.create({
      data: {
        direction: "OUT",
        fromPhone: input.phone,
        text: input.text.slice(0, 2000),
        sentById: input.sentById,
        botAction: input.botAction ?? (input.sentById ? "STAFF_REPLY" : "BOT_REPLY"),
        patientId: input.patientId,
      },
    })
  },

  /** Clears the "needs staff" flag once a human has handled the conversation. */
  async markHandled(phone: string) {
    await prisma.whatsAppInbound.updateMany({
      where: { fromPhone: phone, needsStaff: true, handledByStaff: false },
      data: { handledByStaff: true },
    })
  },

  /** Count of conversations still awaiting a human (for the sidebar/nav badge). */
  async unhandledCount(): Promise<number> {
    const rows = await prisma.whatsAppInbound.findMany({
      where: { needsStaff: true, handledByStaff: false },
      select: { fromPhone: true },
      distinct: ["fromPhone"],
    })
    return rows.length
  },
}
