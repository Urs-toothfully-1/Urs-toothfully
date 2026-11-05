import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { prisma } from "@/lib/prisma"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { clinicKnowledge } from "@/lib/whatsapp/chat-flow"
import { isClinicOpen } from "@/lib/whatsapp/chatbot"

/**
 * AI answers for typed WhatsApp questions the menu bot can't match
 * ("do you do braces?", "where is the Salt Lake clinic?"). Text only.
 *
 * Off unless ANTHROPIC_API_KEY is set. Any failure returns null and the bot
 * falls back to its normal "please tap an option" reply — the AI can never
 * break the chat.
 */

// Haiku: the clinic chose it for cost (~$0.0003/answer) — FAQ answers from a fixed script.
const MODEL = process.env.CHATBOT_AI_MODEL || "claude-haiku-5-5"

const AnswerSchema = z.object({
  reply: z.string().describe("The WhatsApp reply to send the patient. Plain text, short."),
  needs_staff: z.boolean().describe("True when a human at reception should follow up."),
})
export type AiAnswer = z.infer<typeof AnswerSchema>

let client: Anthropic | null = null
export const aiReplyEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY)

// Stable system prompt (cached): rules + the clinic's own script. Branch details
// are appended once per process and change rarely, so the cache still holds.
let systemCache: { text: string; at: number } | null = null
async function systemPrompt(): Promise<string> {
  if (systemCache && Date.now() - systemCache.at < 60 * 60_000) return systemCache.text
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, address: true, phone: true },
  })
  const fees = await Promise.all(
    branches.map((b) => settingsRepository.get("consultation_fee", b.id))
  )
  const branchLines = branches
    .map(
      (b, i) =>
        `- ${b.name}: ${b.address}. Phone ${b.phone}.${fees[i] ? ` Consultation fee ₹${fees[i]}.` : ""}`
    )
    .join("\n")
  const text = `You are the WhatsApp assistant for Ur's Toothfully, a dental clinic in Kolkata (Full Mouth Rehabilitation & Implant Centre).

How to answer:
- Answer ONLY from the clinic information below. If the answer isn't there, say you'll have the team confirm, and set needs_staff to true.
- Keep replies short: 1-4 sentences, friendly, WhatsApp style. At most one emoji. No markdown headings or tables; *bold* is fine.
- Reply in the patient's language (English, Hindi, Bengali or Hinglish - match them).
- Never diagnose, prescribe medicine or give treatment advice beyond general information. For pain, swelling or anything medical, suggest booking a consultation.
- Emergencies (heavy bleeding, facial swelling, trauma, severe pain): tell them to call 7890008331 right away, and set needs_staff to true.
- Don't quote treatment prices: costs depend on the examination, and the doctor gives an estimate at the consultation. You may state the consultation fee.
- Never invent availability, doctors' schedules, offers or discounts. To book, tell them to tap "Book appointment" or type *menu*.
- Set needs_staff to true when they ask for a person, complain, ask about their own bill or records, or you couldn't answer.

Clinic branches:
${branchLines}

Clinic information (from the clinic's own WhatsApp menu):
${clinicKnowledge()}`
  systemCache = { text, at: Date.now() }
  return text
}

export const aiReplyService = {
  /** Answer one typed question, with the recent chat for context. Null = don't use AI this time. */
  async answer(phone: string, question: string): Promise<AiAnswer | null> {
    if (!aiReplyEnabled()) return null
    try {
      client ??= new Anthropic()
      const recent = await prisma.whatsAppInbound.findMany({
        where: { fromPhone: phone },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { direction: true, text: true },
      })
      const history = recent
        .reverse()
        .map(
          (m) => `${m.direction === "IN" ? "Patient" : "Clinic"}: ${(m.text ?? "").slice(0, 500)}`
        )
        .join("\n")
      const now = new Date()
      const when = now.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })

      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
        system: [
          { type: "text", text: await systemPrompt(), cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: `Now: ${when} IST (clinic is ${isClinicOpen(now) ? "open" : "closed"}).\n\nRecent chat:\n${history || "(none)"}\n\nPatient's new message:\n${question.slice(0, 1000)}`,
          },
        ],
      })
      if (response.stop_reason === "refusal" || !response.parsed_output) return null
      const reply = response.parsed_output.reply.trim().slice(0, 1500)
      return reply ? { reply, needs_staff: response.parsed_output.needs_staff } : null
    } catch (err) {
      // Typed SDK errors (rate limit, auth, outage) and parse failures all fall back to the menu bot.
      if (err instanceof Anthropic.APIError)
        console.error(`[whatsapp-ai] API ${err.status}: ${err.message}`)
      else console.error("[whatsapp-ai] failed:", err)
      return null
    }
  },
}
