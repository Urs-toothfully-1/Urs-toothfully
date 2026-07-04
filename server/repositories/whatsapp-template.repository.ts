import { prisma } from "@/lib/prisma"
import { Prisma, WhatsAppTemplateCategory, WhatsAppTemplateStatus } from "@prisma/client"

export interface TemplateListFilters {
  search?: string
  category?: WhatsAppTemplateCategory
  status?: WhatsAppTemplateStatus
  enabledOnly?: boolean
}

export const whatsappTemplateRepository = {
  async findMany(filters: TemplateListFilters = {}) {
    const where: Prisma.WhatsAppTemplateWhereInput = {}
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { displayName: { contains: filters.search, mode: "insensitive" } },
        { body: { contains: filters.search, mode: "insensitive" } },
      ]
    }
    if (filters.category) where.category = filters.category
    if (filters.status) where.status = filters.status
    if (filters.enabledOnly) where.isEnabled = true

    return prisma.whatsAppTemplate.findMany({ where, orderBy: { displayName: "asc" } })
  },

  async findById(id: string) {
    return prisma.whatsAppTemplate.findUnique({ where: { id } })
  },

  async findByName(name: string) {
    return prisma.whatsAppTemplate.findUnique({ where: { name } })
  },

  async findByTriggerKey(triggerKey: string) {
    return prisma.whatsAppTemplate.findUnique({ where: { triggerKey } })
  },

  async create(data: Prisma.WhatsAppTemplateUncheckedCreateInput) {
    return prisma.whatsAppTemplate.create({ data })
  },

  async update(id: string, data: Prisma.WhatsAppTemplateUncheckedUpdateInput) {
    return prisma.whatsAppTemplate.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.whatsAppTemplate.delete({ where: { id } })
  },

  async countByName(names: string[]) {
    return prisma.whatsAppTemplate.count({ where: { name: { in: names } } })
  },
}
