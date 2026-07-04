import { prisma } from "@/lib/prisma"
import { Prisma, WhatsAppSettings } from "@prisma/client"

/**
 * WhatsApp settings are a singleton row — the clinic has one Meta WABA.
 */
export const whatsappSettingsRepository = {
  async get(): Promise<WhatsAppSettings | null> {
    return prisma.whatsAppSettings.findFirst({ orderBy: { createdAt: "asc" } })
  },

  async upsert(data: Omit<Prisma.WhatsAppSettingsUncheckedCreateInput, "id">): Promise<WhatsAppSettings> {
    const existing = await prisma.whatsAppSettings.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } })
    if (existing) {
      return prisma.whatsAppSettings.update({ where: { id: existing.id }, data })
    }
    return prisma.whatsAppSettings.create({ data })
  },

  async patch(data: Prisma.WhatsAppSettingsUncheckedUpdateInput & { updatedById: string }): Promise<WhatsAppSettings | null> {
    const existing = await prisma.whatsAppSettings.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } })
    if (!existing) return null
    return prisma.whatsAppSettings.update({ where: { id: existing.id }, data })
  },
}
