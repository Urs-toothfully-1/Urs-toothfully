import { prisma } from "@/lib/prisma"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { isClinicOpen } from "@/lib/whatsapp/chatbot"
import {
  stepFlow,
  startFlow,
  renderStep,
  toPlainText,
  type FlowData,
} from "@/lib/whatsapp/chat-flow"
import { aiReplyService } from "@/server/services/whatsapp/ai-reply.service"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"

const GREETING = /^(hi+|hello|hey|hlo|namaste|namaskar|start|menu|0|ok|okay|thanks?|thank you)\b/i

const CLOSED_NOTE =
  "🕙 We're currently closed (Mon–Sat 10 AM–8 PM, Sun 10 AM–2:30 PM, Thu off). " +
  "You can still use the menu — our team will follow up during working hours. For emergencies call 7890008331."

const STATE_TTL_MS = 24 * 60 * 60 * 1000 // reset a conversation after 24h idle

const OPT_OUT = /^(stop|stop all|stop messages|unsubscribe|opt ?out)[\s!.]*$/i
const OPT_IN = /^(start|unstop|subscribe|opt ?in)[\s!.]*$/i
const OPT_OUT_REPLY =
  "✅ Done — you won't receive any more automatic messages from Ur's Toothfully. " +
  "You can still message us anytime. Reply *START* to turn them back on."

/**
 * Questionnaire chatbot for inbound patient WhatsApp messages. Drives the
 * menu-tree flow (lib/whatsapp/chat-flow) with per-phone state, records the
 * conversation for the staff inbox, and flags handoffs for reception.
 * Non-blocking: never throws into webhook processing.
 */
export const chatbotService = {
  async handleInbound(input: {
    fromPhone: string
    wamid?: string
    text: string
    replyId?: string
  }) {
    const { fromPhone, wamid, text, replyId } = input

    // Idempotency — Meta retries webhooks.
    if (wamid) {
      const seen = await prisma.whatsAppInbound.findUnique({
        where: { wamid },
        select: { id: true },
      })
      if (seen) return
    }

    // Best-effort patient match (for a friendly name + inbox context).
    const last10 = fromPhone.replace(/\D/g, "").slice(-10)
    const patient = last10
      ? await prisma.patient.findFirst({
          where: { mobile: { contains: last10 } },
          select: { id: true },
        })
      : null

    // Consent by message, for every patient on this number (families share one).
    // Writing to the clinic is an opt-in — unless they said STOP before, which
    // only START undoes. STOP opts out and gets a confirmation, nothing else.
    const onThisNumber = last10
      ? await prisma.patient.findMany({
          where: { mobile: { contains: last10 }, isDeleted: false },
          select: { id: true, whatsappConsent: { select: { consented: true, revokedAt: true } } },
        })
      : []
    const word = text.trim()
    if (!replyId && OPT_OUT.test(word)) {
      for (const p of onThisNumber) await whatsappService.setConsent(p.id, false)
      await prisma.whatsAppInbound.create({
        data: { direction: "IN", fromPhone, patientId: patient?.id, wamid, text: word, botAction: "OPT_OUT" },
      })
      const res = await metaService.sendTextMessage(fromPhone, OPT_OUT_REPLY).catch(() => null)
      if (res?.success) {
        const { whatsappInboxService } = await import("@/server/services/whatsapp/inbox.service")
        await whatsappInboxService
          .logOutbound({ phone: fromPhone, text: OPT_OUT_REPLY, botAction: "BOT_REPLY", patientId: patient?.id })
          .catch(() => null)
      }
      return
    }
    const resume = !replyId && OPT_IN.test(word)
    for (const p of onThisNumber) {
      const c = p.whatsappConsent
      if (!c?.consented && (!c?.revokedAt || resume)) await whatsappService.setConsent(p.id, true)
    }

    // Load / reset conversation state.
    const existing = await prisma.whatsAppChatState.findUnique({ where: { phone: fromPhone } })
    const stale = existing ? Date.now() - existing.updatedAt.getTime() > STATE_TTL_MS : true

    let step
    if (!existing || stale) {
      // Brand-new (or expired) chat → greet with the menu; don't treat the first
      // message as a selection.
      step = startFlow()
      if (!isClinicOpen(new Date())) {
        step.messages[0] = {
          ...step.messages[0],
          text: `${step.messages[0].text}\n\n${CLOSED_NOTE}`,
        }
      }
    } else {
      step = stepFlow(existing.node, (existing.data as FlowData) ?? {}, text, replyId)
    }

    // A typed question the menu can't handle → answer it with AI, then show the
    // options again. Also when a brand-new chat opens with a question instead of
    // "hi". If AI is off or fails, the normal menu reply goes out unchanged.
    const isNewChat = !existing || stale
    const typedQuestion = !replyId && text.trim().length > 3 && !GREETING.test(text.trim())
    let usedAi = false
    if (step.unmatched || (isNewChat && typedQuestion)) {
      const ai = await aiReplyService.answer(fromPhone, text)
      if (ai) {
        if (step.unmatched) step = renderStep(step.node, step.data) // drop the "Sorry…" note
        step.messages = [{ text: ai.reply }, ...step.messages]
        step.handoff = step.handoff || ai.needs_staff
        usedAi = true
      }
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
        botAction: step.handoff ? "HANDOFF" : usedAi ? "AI_REPLY" : "BOT_FLOW",
        needsStaff: step.handoff,
      },
    })

    // Send the bot's reply(ies) and log them to the inbox thread. Non-fatal.
    const { whatsappInboxService } = await import("@/server/services/whatsapp/inbox.service")
    for (const msg of step.messages) {
      const plain = toPlainText(msg)
      // Interactive (buttons/list/link) first; plain numbered text if that fails.
      let res = msg.ui
        ? await metaService.sendInteractiveMessage(fromPhone, msg).catch(() => null)
        : null
      if (!res?.success) res = await metaService.sendTextMessage(fromPhone, plain).catch(() => null)
      if (res?.success) {
        await whatsappInboxService
          .logOutbound({
            phone: fromPhone,
            text: plain,
            botAction: "BOT_REPLY",
            patientId: patient?.id,
          })
          .catch(() => null)
      }
    }
  },
}
