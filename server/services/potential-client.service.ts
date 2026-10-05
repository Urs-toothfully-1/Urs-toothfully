import type { LeadStatus, Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { validateMobile } from "@/lib/whatsapp/phone"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"

/**
 * Potential clients — marketing leads imported from a CSV (not patients yet).
 * Only leads marked as opted-in are ever messaged on WhatsApp.
 */

export const leadRowSchema = z.object({
  fullName: z.string().trim().min(1, "Name is missing").max(200),
  mobile: z.string().trim().min(1, "Mobile is missing").max(30),
  email: z.string().trim().max(150).optional(),
  area: z.string().trim().max(150).optional(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
})
export type LeadRow = z.infer<typeof leadRowSchema>

/** Stored form: 10-digit for Indian mobiles, full digits otherwise. */
export function normalizeLeadMobile(raw: string): string | null {
  const v = validateMobile(raw)
  if (!v.valid || !v.normalized) return null
  return v.normalized.startsWith("91") && v.normalized.length === 12 ? v.normalized.slice(2) : v.normalized
}

export const potentialClientService = {
  /** Upserts by mobile. Existing leads keep their data; blanks are filled and opt-in can only be granted, not removed. */
  async importRows(rawRows: unknown[], optIn: boolean, source: string | undefined, userId: string) {
    if (rawRows.length > 5000) throw new Error("Import up to 5,000 rows at a time.")
    let created = 0
    let updated = 0
    const skipped: { row: number; reason: string }[] = []
    const seen = new Set<string>()

    for (let i = 0; i < rawRows.length; i++) {
      const parsed = leadRowSchema.safeParse(rawRows[i])
      if (!parsed.success) { skipped.push({ row: i + 2, reason: parsed.error.issues[0].message }); continue }
      const r = parsed.data
      const mobile = normalizeLeadMobile(r.mobile)
      if (!mobile) { skipped.push({ row: i + 2, reason: `Invalid mobile "${r.mobile}"` }); continue }
      if (seen.has(mobile)) { skipped.push({ row: i + 2, reason: "Duplicate mobile in this file" }); continue }
      seen.add(mobile)

      const existing = await prisma.potentialClient.findUnique({ where: { mobile } })
      if (existing) {
        await prisma.potentialClient.update({
          where: { id: existing.id },
          data: {
            email: existing.email ?? (r.email || null),
            area: existing.area ?? (r.area || null),
            source: existing.source ?? (r.source || source || null),
            notes: existing.notes ?? (r.notes || null),
            whatsappOptIn: existing.whatsappOptIn || optIn,
          },
        })
        updated++
      } else {
        await prisma.potentialClient.create({
          data: {
            fullName: r.fullName, mobile, email: r.email || null, area: r.area || null,
            source: r.source || source || "CSV import", notes: r.notes || null, whatsappOptIn: optIn, createdById: userId,
          },
        })
        created++
      }
    }
    await createAuditLog({ entityType: "PotentialClient", entityId: "import", action: "CREATE", changedById: userId, newValues: { created, updated, skipped: skipped.length } })
    return { created, updated, skipped }
  },

  async list(opts: { search?: string; status?: LeadStatus; optIn?: boolean; page?: number }) {
    const pageSize = 50
    const page = Math.max(1, opts.page ?? 1)
    const q = opts.search?.trim()
    const where: Prisma.PotentialClientWhereInput = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.optIn !== undefined ? { whatsappOptIn: opts.optIn } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { mobile: { contains: q.replace(/\D/g, "") || q } }, { area: { contains: q, mode: "insensitive" } }] } : {}),
    }
    const [rows, total, counts] = await Promise.all([
      prisma.potentialClient.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.potentialClient.count({ where }),
      prisma.potentialClient.groupBy({ by: ["status"], _count: { _all: true } }),
    ])
    // Flag leads who are already patients (same mobile).
    const patients = await prisma.patient.findMany({
      where: { mobile: { in: rows.map((r) => r.mobile) }, isDeleted: false },
      select: { id: true, mobile: true, patientId: true },
    })
    const byMobile = new Map(patients.map((p) => [p.mobile, p]))
    return {
      rows: rows.map((r) => ({ ...r, patient: byMobile.get(r.mobile) ?? null })),
      total, page, pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<LeadStatus, number>>,
      optedIn: await prisma.potentialClient.count({ where: { whatsappOptIn: true } }),
    }
  },

  async add(raw: unknown, optIn: boolean, userId: string) {
    const r = leadRowSchema.parse(raw)
    const mobile = normalizeLeadMobile(r.mobile)
    if (!mobile) throw new Error("Enter a valid mobile number.")
    if (await prisma.potentialClient.findUnique({ where: { mobile } })) throw new Error("A potential client with this mobile already exists.")
    return prisma.potentialClient.create({
      data: { fullName: r.fullName, mobile, email: r.email || null, area: r.area || null, source: r.source || "Manual", notes: r.notes || null, whatsappOptIn: optIn, createdById: userId },
    })
  },

  async update(id: string, data: { status?: LeadStatus; whatsappOptIn?: boolean }) {
    return prisma.potentialClient.update({ where: { id }, data })
  },

  async remove(ids: string[], userId: string) {
    const res = await prisma.potentialClient.deleteMany({ where: { id: { in: ids } } })
    await createAuditLog({ entityType: "PotentialClient", entityId: "bulk", action: "DELETE", changedById: userId, newValues: { count: res.count } })
    return res.count
  },

  /**
   * Queue an approved WhatsApp template to the selected leads. Leads without
   * opt-in are skipped. `{name}` in a variable is replaced with the lead's name.
   */
  async sendWhatsApp(input: { ids: string[]; templateId: string; variables: string[]; branchId: string; userId: string }) {
    if (input.ids.length === 0) throw new Error("Select at least one potential client.")
    if (input.ids.length > 1000) throw new Error("Send to at most 1,000 at a time.")
    const template = await prisma.whatsAppTemplate.findUnique({ where: { id: input.templateId }, select: { status: true, isEnabled: true, displayName: true } })
    if (!template) throw new Error("Template not found.")
    if (template.status !== "APPROVED") throw new Error(`"${template.displayName}" is not approved by Meta yet.`)
    const leads = await prisma.potentialClient.findMany({ where: { id: { in: input.ids } } })

    let sent = 0
    let skipped = 0
    const failed: string[] = []
    for (const lead of leads) {
      if (!lead.whatsappOptIn) { skipped++; continue }
      try {
        await whatsappQueueService.enqueue({
          branchId: input.branchId,
          templateId: input.templateId,
          toPhone: lead.mobile,
          variables: input.variables.map((v) => v.replaceAll("{name}", lead.fullName.split(" ")[0])),
          createdById: input.userId,
        })
        await prisma.potentialClient.update({
          where: { id: lead.id },
          data: { lastMessagedAt: new Date(), messageCount: { increment: 1 }, status: lead.status === "NEW" ? "CONTACTED" : lead.status },
        })
        sent++
      } catch (e) {
        failed.push(`${lead.fullName}: ${e instanceof Error ? e.message : "failed"}`)
        // The emergency stop / disabled template applies to everyone — no point continuing.
        if (e instanceof Error && /disabled|emergency/i.test(e.message)) break
      }
    }
    await createAuditLog({ entityType: "PotentialClient", entityId: "whatsapp", action: "CREATE", changedById: input.userId, newValues: { sent, skipped, failed: failed.length } })
    return { sent, skipped, failed }
  },
}
