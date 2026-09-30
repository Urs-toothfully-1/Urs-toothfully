"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Send, Loader2, RefreshCw, MessageSquare } from "lucide-react"
import { BRAND_COLORS } from "@/lib/constants"
import {
  sendInboxReplyAction,
  markConversationHandledAction,
  fetchThreadAction,
  fetchConversationsAction,
} from "@/actions/whatsapp-inbox"
import type { ConversationSummary, ThreadMessage } from "@/server/services/whatsapp/inbox.service"

function fmtPhone(p: string): string {
  if (p.length === 12 && p.startsWith("91")) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`
  return `+${p}`
}
function fmtTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "short" })
}

export function WhatsAppInbox({ initialConversations }: { initialConversations: ConversationSummary[] }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations)
  const [active, setActive] = useState<ConversationSummary | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply, setReply] = useState("")
  const [sending, startSending] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  const openConversation = async (c: ConversationSummary) => {
    setActive(c)
    setLoadingThread(true)
    const res = await fetchThreadAction(c.phone)
    setThread(res.messages ?? [])
    setLoadingThread(false)
    if (c.unreadForStaff > 0) {
      await markConversationHandledAction(c.phone)
      setConversations((prev) => prev.map((x) => (x.phone === c.phone ? { ...x, unreadForStaff: 0 } : x)))
    }
  }

  const refresh = async () => {
    const [cRes, tRes] = await Promise.all([
      fetchConversationsAction(),
      active ? fetchThreadAction(active.phone) : Promise.resolve({ messages: undefined }),
    ])
    if (cRes.conversations) setConversations(cRes.conversations)
    if (tRes.messages) setThread(tRes.messages)
  }

  // Light, visibility-aware polling (20s) — only refetches while the tab is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, 20000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.phone])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [thread])

  const send = () => {
    if (!active || !reply.trim()) return
    const text = reply.trim()
    startSending(async () => {
      const res = await sendInboxReplyAction(active.phone, text)
      if (res.success) {
        setReply("")
        setThread((prev) => [
          ...prev,
          { id: `local-${Date.now()}`, direction: "OUT", kind: "text", body: text, at: new Date().toISOString(), meta: "you" },
        ])
      } else {
        toast.error(res.error ?? "Failed to send")
      }
    })
  }

  return (
    <div className="flex border rounded-xl overflow-hidden bg-white" style={{ borderColor: "#E0E3E5", height: "calc(100vh - 260px)", minHeight: 460 }}>
      {/* Conversation list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: "#E0E3E5" }}>
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#E0E3E5" }}>
          <span className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Chats</span>
          <button onClick={refresh} className="p-1 rounded hover:bg-gray-100" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.borderDivider }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: BRAND_COLORS.borderDivider }}>No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.phone}
                onClick={() => openConversation(c)}
                className="w-full text-left px-3 py-2.5 border-b hover:bg-gray-50 transition-colors"
                style={{
                  borderColor: "#F0F2F4",
                  backgroundColor: active?.phone === c.phone ? `${BRAND_COLORS.primaryTeal}0D` : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: BRAND_COLORS.bodyText }}>
                    {c.patientName ?? fmtPhone(c.phone)}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: BRAND_COLORS.borderDivider }}>{fmtTime(c.lastAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs truncate" style={{ color: BRAND_COLORS.borderDivider }}>
                    {c.lastDirection === "OUT" ? "You: " : ""}{c.lastText ?? "—"}
                  </span>
                  {c.unreadForStaff > 0 && (
                    <span className="flex-shrink-0 text-[10px] font-bold text-white rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#25D366" }}>
                      {c.unreadForStaff}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: BRAND_COLORS.borderDivider }}>
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "#E0E3E5" }}>
              <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{active.patientName ?? fmtPhone(active.phone)}</p>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{fmtPhone(active.phone)}</p>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ backgroundColor: "#F7F8FA" }}>
              {loadingThread ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" style={{ color: BRAND_COLORS.primaryTeal }} /></div>
              ) : thread.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: BRAND_COLORS.borderDivider }}>No messages.</p>
              ) : (
                thread.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words"
                      style={{
                        backgroundColor: m.direction === "OUT" ? BRAND_COLORS.primaryTeal : "white",
                        color: m.direction === "OUT" ? "white" : BRAND_COLORS.bodyText,
                        border: m.direction === "OUT" ? "none" : "1px solid #E0E3E5",
                      }}
                    >
                      <div>{m.body}</div>
                      <div className="text-[10px] mt-1 opacity-70">{fmtTime(m.at)}{m.meta ? ` · ${m.meta}` : ""}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t p-2 flex items-end gap-2" style={{ borderColor: "#E0E3E5" }}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Type a reply… (free within 24h of the patient's last message)"
                rows={1}
                className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: "#E0E3E5" }}
              />
              <button
                onClick={send}
                disabled={sending || !reply.trim()}
                className="h-9 px-4 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
