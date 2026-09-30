import { prisma } from "@/lib/prisma"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { isClinicOpen } from "@/lib/whatsapp/chatbot"
import { stepFlow, startFlow, type FlowData } from "@/lib/whatsapp/chat-flow"

const CLOSED_NOTE =
  "🕙 We're currently closed (Mon–Sat 10 AM–7:30 PM, Sun 10 AM–2:30 PM, Thu off). " +
  "You can still use the menu — our team will follow up during working hours. For emergencies call 7890008331."

const STATE_TTL_MS = 24 * 60 * 60 * 1000 // reset a conversation after 24h idle

/**
 * Questionnaire chatbot for inbound patient WhatsApp messages. Drives the
 * menu-tree flow (lib/whatsapp/chat-flow) with per-phone state, records the
 * conversation for the staff inbox, and flags handoffs for reception.
 * Non-blocking: never throws into webhook processing.
 */
export const chatbotService = {
  async handleInbound(input: { fromPhone: string; wamid?: string; text: string }) {
    const { fromPhone, wamid, text } = input

    // Idempotency — Meta retries webhooks.
    if (wamid) {
      const seen = await prisma.whatsAppInbound.findUnique({ where: { wamid }, select: { id: true } })
      if (seen) return
    }

    // Best-effort patient match (for a friendly name + inbox context).
    const last10 = fromPhone.replace(/\D/g, "").slice(-10)
    const patient = last10
      ? await prisma.patient.findFirst({ where: { mobile: { contains: last10 } }, select: { id: true } })
      : null

    // Load / reset conversation state.
    const existing = await prisma.whatsAppChatState.findUnique({ where: { phone: fromPhone } })
    const stale = existing ? Date.now() - existing.updatedAt.getTime() > STATE_TTL_MS : true

    let step
    if (!existing || stale) {
      // Brand-new (or expired) chat → greet with the menu; don't treat the first
      // message as a selection.
      step = startFlow()
      if (!isClinicOpen(new Date())) step.messages = [`${step.messages[0]}\n\n${CLOSED_NOTE}`]
    } else {
      step = stepFlow(existing.node, (existing.data as FlowData) ?? {}, text)
    }

    await prisma.whatsAppChatState.upsert({
      where: { phone: fromPhone },
      create: { phone: fromPhone, node: step.node, data: step.data },
      update: { node: step.node, data: step.data },
    })

    // Log the inbound message (flag for staff on handoff).
    await prisma.whatsAppInbound.create({
      data: {
        direction: "IN",
        fromPhone,
        patientId: patient?.id,
        wamid,
        text: text.slice(0, 2000),
        botAction: step.handoff ? "HANDOFF" : "BOT_FLOW",
        needsStaff: step.handoff,
      },
    })

    // Send the bot's reply(ies) and log them to the inbox thread. Non-fatal.
    const { whatsappInboxService } = await import("@/server/services/whatsapp/inbox.service")
    for (const msg of step.messages) {
      const res = await metaService.sendTextMessage(fromPhone, msg).catch(() => null)
      if (res?.success) {
        await whatsappInboxService
          .logOutbound({ phone: fromPhone, text: msg, botAction: "BOT_REPLY", patientId: patient?.id })
          .catch(() => null)
      }
    }
  },
}
