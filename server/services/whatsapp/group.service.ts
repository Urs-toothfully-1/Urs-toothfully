import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"

/**
 * WhatsApp groups ("sections"): a named list of patients that admin/reception
 * can message in one go with any approved template (promotions, camps,
 * reminders). Every queued message carries groupId, which is the group's log.
 * Consent is enforced by the queue — patients without it are skipped.
 */

export const groupInputSchema = z.object({
  name: z.string().trim().min(2, "Give the group a name").max(100),
  description: z.string().trim().max(300).optional(),
})

const MAX_SEND = 2000

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || full

export const whatsappGroupService = {
  async list() {
    const groups = await prisma.whatsAppGroup.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { members: true, messages: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    })
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      createdBy: g.createdBy.name,
      members: g._count.members,
      messages: g._count.messages,
      lastSentAt: g.messages[0]?.createdAt ?? null,
    }))
  },

  async create(raw: unknown, userId: string) {
    const input = groupInputSchema.parse(raw)
    if (await prisma.whatsAppGroup.findUnique({ where: { name: input.name } }))
      throw new Error("A group with this name already exists.")
    const g = await prisma.whatsAppGroup.create({
      data: { name: input.name, description: input.description || null, createdById: userId },
    })
    await createAuditLog({ entityType: "WhatsAppGroup", entityId: g.id, action: "CREATE", changedById: userId, newValues: { name: g.name } })
    return g
  },

  async update(id: string, raw: unknown, userId: string) {
    const input = groupInputSchema.parse(raw)
    const clash = await prisma.whatsAppGroup.findFirst({ where: { name: input.name, NOT: { id } } })
    if (clash) throw new Error("A group with this name already exists.")
    await prisma.whatsAppGroup.update({ where: { id }, data: { name: input.name, description: input.description || null } })
    await createAuditLog({ entityType: "WhatsAppGroup", entityId: id, action: "UPDATE", changedById: userId, newValues: input })
  },

  /** Members go with the group; the sent-message log is kept (groupId becomes null). */
  async remove(id: string, userId: string) {
    const g = await prisma.whatsAppGroup.delete({ where: { id } })
    await createAuditLog({ entityType: "WhatsAppGroup", entityId: id, action: "DELETE", changedById: userId, newValues: { name: g.name } })
  },

  async get(id: string) {
    const group = await prisma.whatsAppGroup.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } } },
    })
    if (!group) return null
    const members = await prisma.whatsAppGroupMember.findMany({
      where: { groupId: id },
      orderBy: { addedAt: "desc" },
      include: {
        patient: {
          select: { id: true, patientId: true, fullName: true, mobile: true, isDeleted: true, whatsappConsent: { select: { consented: true, revokedAt: true } } },
        },
      },
    })
    return {
      ...group,
      members: members.map((m) => ({
        patientId: m.patient.id,
        code: m.patient.patientId,
        name: m.patient.fullName,
        mobile: m.patient.mobile,
        consent: !!m.patient.whatsappConsent?.consented && !m.patient.whatsappConsent.revokedAt && !m.patient.isDeleted,
        addedAt: m.addedAt,
      })),
    }
  },

  async addMembers(groupId: string, patientIds: string[], userId: string) {
    const ids = [...new Set(patientIds)].slice(0, 5000)
    if (!ids.length) return { added: 0 }
    const res = await prisma.whatsAppGroupMember.createMany({
      data: ids.map((patientId) => ({ groupId, patientId, addedById: userId })),
      skipDuplicates: true,
    })
    await prisma.whatsAppGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } })
    return { added: res.count }
  },

  /**
   * Paste-to-add: mobiles or patient IDs (PT-…), separated by commas, spaces or
   * new lines. Returns what matched and what didn't, so staff can fix typos.
   */
  async addByCodes(groupId: string, text: string, userId: string) {
    const tokens = [...new Set(text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 2000)
    if (!tokens.length) return { added: 0, matched: 0, notFound: [] as string[] }
    const mobiles = tokens.map((t) => t.replace(/\D/g, "").slice(-10)).filter((m) => m.length === 10)
    const found = await prisma.patient.findMany({
      where: {
        isDeleted: false,
        OR: [{ patientId: { in: tokens.map((t) => t.toUpperCase()) } }, { mobile: { in: mobiles } }],
      },
      select: { id: true, patientId: true, mobile: true },
    })
    const hit = new Set(found.flatMap((p) => [p.patientId.toUpperCase(), p.mobile]))
    const notFound = tokens.filter((t) => !hit.has(t.toUpperCase()) && !hit.has(t.replace(/\D/g, "").slice(-10)))
    const { added } = await this.addMembers(groupId, found.map((p) => p.id), userId)
    return { added, matched: found.length, notFound }
  },

  async removeMember(groupId: string, patientId: string) {
    await prisma.whatsAppGroupMember.deleteMany({ where: { groupId, patientId } })
  },

  /** Queue one approved template to every member. `{name}` → each member's first name. */
  async send(input: { groupId: string; templateId: string; variables: string[]; branchId: string; userId: string }) {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: input.templateId },
      select: { status: true, isEnabled: true, displayName: true, variables: true },
    })
    if (!template) throw new Error("Template not found.")
    if (template.status !== "APPROVED") throw new Error(`"${template.displayName}" is not approved by Meta yet.`)
    const needed = Array.isArray(template.variables) ? template.variables.length : 0
    if (input.variables.length < needed || input.variables.some((v) => !v.trim()))
      throw new Error("Fill in every template field.")

    const members = await prisma.whatsAppGroupMember.findMany({
      where: { groupId: input.groupId, patient: { isDeleted: false } },
      include: { patient: { select: { id: true, fullName: true, mobile: true } } },
      take: MAX_SEND + 1,
    })
    if (members.length === 0) throw new Error("This group has no patients yet.")
    if (members.length > MAX_SEND) throw new Error(`Groups can send to at most ${MAX_SEND.toLocaleString("en-IN")} at a time.`)

    let sent = 0
    let skipped = 0
    const failed: string[] = []
    for (const m of members) {
      try {
        await whatsappQueueService.enqueue({
          patientId: m.patient.id,
          branchId: input.branchId,
          templateId: input.templateId,
          toPhone: m.patient.mobile,
          variables: input.variables.map((v) => v.replaceAll("{name}", firstName(m.patient.fullName))),
          createdById: input.userId,
          groupId: input.groupId,
        })
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed"
        if (/consent/i.test(msg)) { skipped++; continue }
        failed.push(`${m.patient.fullName}: ${msg}`)
        // Emergency stop / disabled template applies to everyone.
        if (/disabled|emergency/i.test(msg)) break
      }
    }
    await prisma.whatsAppGroup.update({ where: { id: input.groupId }, data: { updatedAt: new Date() } })
    await createAuditLog({
      entityType: "WhatsAppGroup", entityId: input.groupId, action: "CREATE", changedById: input.userId,
      newValues: { action: "group_send", template: template.displayName, sent, skipped, failed: failed.length },
    })
    return { sent, skipped, failed }
  },

  /** The group's message log, newest first. */
  async log(groupId: string, take = 300) {
    const rows = await prisma.whatsAppMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true, templateName: true, status: true, createdAt: true, sentAt: true, failureReason: true,
        template: { select: { displayName: true } },
        patient: { select: { id: true, fullName: true, patientId: true } },
        createdBy: { select: { name: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      template: r.template?.displayName ?? r.templateName,
      status: r.status,
      createdAt: r.createdAt,
      sentAt: r.sentAt,
      failureReason: r.failureReason,
      patient: r.patient ? { id: r.patient.id, name: r.patient.fullName, code: r.patient.patientId } : null,
      sentBy: r.createdBy?.name ?? "—",
    }))
  },
}
