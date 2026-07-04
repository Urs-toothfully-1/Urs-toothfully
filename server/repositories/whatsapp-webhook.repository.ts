import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const whatsappWebhookRepository = {
  async log(data: {
    eventType?: string
    metaMessageId?: string
    payload: Prisma.InputJsonValue
    processed: boolean
    error?: string
  }) {
    return prisma.whatsAppWebhookLog.create({ data })
  },

  async findRecent(limit = 100) {
    return prisma.whatsAppWebhookLog.findMany({
      orderBy: { receivedAt: "desc" },
      take: limit,
    })
  },
}
