"use server"

import { requireRole } from "@/lib/auth"
import { metaService } from "@/server/services/whatsapp/meta.service"
import { whatsappInboxService, type ThreadMessage, type ConversationSummary } from "@/server/services/whatsapp/inbox.service"

const ROLES = ["ADMIN", "RECEPTIONIST"] as const

/**
 * Sends a free-form reply to a patient (session message — free within the 24h
 * customer-service window). Meta rejects it outside that window (#131047), which
 * we surface so staff know to use a template instead.
 */
export async function sendInboxReplyAction(
  phone: string,
  text: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole([...ROLES]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  const body = text.trim()
  if (!body) return { error: "Message is empty." }
  if (!/^\d{8,15}$/.test(phone)) return { error: "Invalid phone." }

  const res = await metaService.sendTextMessage(phone, body)
  if (!res.success) {
    return {
      error:
        res.error?.includes("24") || res.error?.toLowerCase().includes("re-engagement") || res.error?.includes("131047")
          ? "This chat is outside the 24-hour reply window. Send an approved template from the Queue instead."
          : res.error ?? "Failed to send.",
    }
  }
  await whatsappInboxService.logOutbound({ phone, text: body, sentById: session.userId })
  await whatsappInboxService.markHandled(phone)
  return { success: true }
}

export async function markConversationHandledAction(phone: string): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole([...ROLES]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  await whatsappInboxService.markHandled(phone)
  return { success: true }
}

/** For the client to refresh the open thread / conversation list without a full reload. */
export async function fetchThreadAction(phone: string): Promise<{ messages?: ThreadMessage[]; error?: string }> {
  const session = await requireRole([...ROLES]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  return { messages: await whatsappInboxService.getThread(phone) }
}

export async function fetchConversationsAction(): Promise<{ conversations?: ConversationSummary[]; error?: string }> {
  const session = await requireRole([...ROLES]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  return { conversations: await whatsappInboxService.listConversations() }
}
