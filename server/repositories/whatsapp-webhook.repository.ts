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

  /** Deletes webhook logs older than `days` — keeps the table (and Supabase
   *  storage) from growing unbounded, one row per status event per message. */
  async pruneOlderThan(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const { count } = await prisma.whatsAppWebhookLog.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    })
    return { deleted: count }
  },
}
