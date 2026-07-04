import { z } from "zod"
import { WhatsAppTemplateStatus } from "@prisma/client"
import { whatsappTemplateRepository, TemplateListFilters } from "@/server/repositories/whatsapp-template.repository"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { DEFAULT_UTILITY_TEMPLATES, countTemplateVariables } from "@/lib/whatsapp/templates"
import { createAuditLog } from "@/lib/audit"
import { prisma } from "@/lib/prisma"

export const templateSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Template name must be lowercase letters, numbers and underscores (Meta requirement)"),
  displayName: z.string().min(2).max(150),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
  language: z.string().min(2).max(10).default("en"),
  headerType: z.enum(["TEXT", "IMAGE", "DOCUMENT"]).optional().nullable(),
  headerText: z.string().max(200).optional().nullable(),
  body: z.string().min(5).max(1024),
  footerText: z.string().max(200).optional().nullable(),
  buttons: z
    .array(z.object({ type: z.string(), text: z.string().max(25), url: z.string().optional() }))
    .max(3)
    .optional()
    .nullable(),
  variables: z.array(z.string().max(60)).max(10).default([]),
  triggerKey: z.string().max(60).optional().nullable(),
})

export type TemplateInput = z.infer<typeof templateSchema>

function validateVariableCount(input: TemplateInput) {
  const placeholders = countTemplateVariables(input.body)
  if (placeholders !== input.variables.length) {
    throw new Error(
      `Body uses ${placeholders} placeholder(s) ({{n}}) but ${input.variables.length} variable label(s) were provided.`
    )
  }
}

export const templateService = {
  async list(filters: TemplateListFilters = {}) {
    return whatsappTemplateRepository.findMany(filters)
  },

  async getById(id: string) {
    return whatsappTemplateRepository.findById(id)
  },

  async create(input: TemplateInput, createdById: string) {
    validateVariableCount(input)
    const existing = await whatsappTemplateRepository.findByName(input.name)
    if (existing) throw new Error(`A template named "${input.name}" already exists.`)
    if (input.triggerKey) {
      const trigger = await whatsappTemplateRepository.findByTriggerKey(input.triggerKey)
      if (trigger) throw new Error(`Trigger "${input.triggerKey}" is already linked to "${trigger.displayName}".`)
    }

    const template = await whatsappTemplateRepository.create({
      ...input,
      buttons: input.buttons ?? undefined,
      status: "DRAFT",
      createdById,
    })

    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: template.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { name: input.name, category: input.category },
    })
    return template
  },

  async update(id: string, input: Partial<TemplateInput> & { isEnabled?: boolean }, changedById: string) {
    const template = await whatsappTemplateRepository.findById(id)
    if (!template) throw new Error("Template not found")

    if (input.body !== undefined || input.variables !== undefined) {
      const body = input.body ?? template.body
      const variables = input.variables ?? ((template.variables as string[] | null) ?? [])
      const placeholders = countTemplateVariables(body)
      if (placeholders !== variables.length) {
        throw new Error(`Body uses ${placeholders} placeholder(s) but ${variables.length} variable label(s) were provided.`)
      }
    }

    // Editing content of an already-approved template puts it back to DRAFT —
    // Meta must re-approve content changes.
    const contentChanged =
      (input.body !== undefined && input.body !== template.body) ||
      (input.headerText !== undefined && input.headerText !== template.headerText) ||
      (input.footerText !== undefined && input.footerText !== template.footerText)

    const updated = await whatsappTemplateRepository.update(id, {
      ...input,
      variables: input.variables ?? undefined,
      buttons: input.buttons ?? undefined,
      ...(contentChanged && template.status === "APPROVED" && { status: "DRAFT" as WhatsAppTemplateStatus }),
    })

    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: id,
      action: "UPDATE",
      changedById,
      previousValues: { body: template.body, isEnabled: template.isEnabled },
      newValues: { ...input },
    })
    return updated
  },

  async setEnabled(id: string, isEnabled: boolean, changedById: string) {
    const updated = await whatsappTemplateRepository.update(id, { isEnabled })
    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: id,
      action: "STATUS_CHANGE",
      changedById,
      newValues: { isEnabled },
    })
    return updated
  },

  async delete(id: string, changedById: string) {
    const template = await whatsappTemplateRepository.findById(id)
    if (!template) throw new Error("Template not found")
    if (template.isSystem) throw new Error("System default templates cannot be deleted. Disable it instead.")

    const usedCount = await prisma.whatsAppMessage.count({ where: { templateId: id } })
    if (usedCount > 0) {
      // keep history intact — detach and delete is not allowed; disable instead
      throw new Error("This template has message history and cannot be deleted. Disable it instead.")
    }

    await whatsappTemplateRepository.delete(id)
    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: id,
      action: "DELETE",
      changedById,
      previousValues: { name: template.name },
    })
  },

  /** Seeds the 20 default utility templates. Idempotent. */
  async ensureDefaults(createdById: string) {
    const names = DEFAULT_UTILITY_TEMPLATES.map((t) => t.name)
    const existingCount = await whatsappTemplateRepository.countByName(names)
    if (existingCount >= names.length) return { created: 0 }

    let created = 0
    for (const def of DEFAULT_UTILITY_TEMPLATES) {
      const exists = await whatsappTemplateRepository.findByName(def.name)
      if (exists) continue
      await whatsappTemplateRepository.create({
        name: def.name,
        displayName: def.displayName,
        category: "UTILITY",
        language: "en",
        status: "DRAFT",
        body: def.body,
        footerText: def.footerText,
        variables: def.variables,
        triggerKey: def.triggerKey,
        isSystem: true,
        createdById,
      })
      created++
    }
    return { created }
  },

  /** Pulls template status/ids from Meta and updates matching local templates. */
  async syncFromMeta(changedById: string) {
    const metaTemplates = await metaService.fetchTemplatesFromMeta()
    let updated = 0

    for (const mt of metaTemplates) {
      const local = await whatsappTemplateRepository.findByName(mt.name)
      if (!local) continue

      const status: WhatsAppTemplateStatus =
        mt.status === "APPROVED" ? "APPROVED"
        : mt.status === "REJECTED" ? "REJECTED"
        : mt.status === "DISABLED" || mt.status === "PAUSED" ? "DISABLED"
        : "PENDING"

      if (local.metaTemplateId !== mt.id || local.status !== status) {
        await whatsappTemplateRepository.update(local.id, { metaTemplateId: mt.id, status })
        updated++
      }
    }

    await prisma.whatsAppSettings.updateMany({ data: { lastSyncAt: new Date() } })
    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: "SYNC",
      action: "UPDATE",
      changedById,
      newValues: { syncedFromMeta: metaTemplates.length, updated },
    })
    return { total: metaTemplates.length, updated }
  },

  /** Submits a local DRAFT template to Meta for approval. */
  async syncToMeta(id: string, changedById: string) {
    const template = await whatsappTemplateRepository.findById(id)
    if (!template) throw new Error("Template not found")
    if (template.status === "APPROVED" || template.status === "PENDING") {
      throw new Error("This template is already submitted to Meta.")
    }

    const metaTemplateId = await metaService.createTemplateOnMeta(template)
    const updated = await whatsappTemplateRepository.update(id, { metaTemplateId, status: "PENDING" })

    await createAuditLog({
      entityType: "WhatsAppTemplate",
      entityId: id,
      action: "EXPORT",
      changedById,
      newValues: { metaTemplateId },
    })
    return updated
  },
}
