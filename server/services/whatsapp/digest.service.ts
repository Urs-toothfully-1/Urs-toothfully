import { prisma } from "@/lib/prisma"
import { whatsappSettingsRepository } from "@/server/repositories/whatsapp-settings.repository"
import { whatsappTemplateRepository } from "@/server/repositories/whatsapp-template.repository"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"
import { WHATSAPP_TRIGGERS } from "@/lib/whatsapp/templates"

/**
 * End-of-day WhatsApp summary for the clinic owner/admin. Sent to the phone
 * configured in WhatsApp Settings (dailyDigestPhone) when enabled. Not
 * patient-linked, so consent/consultation gates don't apply.
 */
export const digestService = {
  async computeDailySummary() {
    const now = new Date()
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)

    const [visits, revenue, paymentsCount, outstandingEstimates] = await Promise.all([
      prisma.patientVisit.findMany({
        where: { visitDate: { gte: start, lte: end } },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      prisma.accountingEntry.aggregate({
        where: { isDeleted: false, entryDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { isDeleted: false, paymentDate: { gte: start, lte: end } } }),
      prisma.estimate.findMany({
        where: { status: "ACTIVE", isDeleted: false },
        select: {
          total: true,
          payments: { where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } }, select: { amount: true } },
        },
      }),
    ])

    const totalOutstanding = outstandingEstimates.reduce((s, e) => {
      const paid = e.payments.reduce((ps, p) => ps + Number(p.amount), 0)
      return s + Math.max(0, Number(e.total) - paid)
    }, 0)

    const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 })

    return {
      date: now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      patientsSeen: visits.length,
      revenueToday: fmt(Number(revenue._sum.amount ?? 0)),
      paymentsCount: paymentsCount,
      outstandingTotal: fmt(totalOutstanding),
    }
  },

  async sendDailyDigest(): Promise<{ queued: boolean; reason?: string }> {
    const settings = await whatsappSettingsRepository.get()
    if (!settings?.dailyDigestEnabled) return { queued: false, reason: "Daily digest is disabled" }
    if (!settings.dailyDigestPhone) return { queued: false, reason: "No digest phone configured" }

    const template = await whatsappTemplateRepository.findByTriggerKey(WHATSAPP_TRIGGERS.DAILY_SUMMARY)
    if (!template || !template.isEnabled) return { queued: false, reason: "daily_summary template missing or disabled" }

    const s = await this.computeDailySummary()
    await whatsappQueueService.enqueue({
      templateId: template.id,
      toPhone: settings.dailyDigestPhone,
      variables: [s.date, String(s.patientsSeen), s.revenueToday, String(s.paymentsCount), s.outstandingTotal],
      triggerKey: WHATSAPP_TRIGGERS.DAILY_SUMMARY,
    })
    return { queued: true }
  },
}
