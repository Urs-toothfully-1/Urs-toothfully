"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, MessageSquare, Phone, RefreshCw, Search, Send, User } from "lucide-react"
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
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
function fmtListTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return "Yesterday"
  return d.toLocaleDateString([], { day: "2-digit", month: "short" })
}
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return "Today"
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return "Yesterday"
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })
}
const initials = (c: ConversationSummary) =>
  c.patientName ? c.patientName.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : null

/**
 * WhatsApp-style inbox. Phone: chat list → tap a chat → full-screen thread with
 * a back arrow. Tablet/desktop: list and thread side by side.
 */
export function WhatsAppInbox({ initialConversations }: { initialConversations: ConversationSummary[] }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations)
  const [active, setActive] = useState<ConversationSummary | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply, setReply] = useState("")
  const [query, setQuery] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, startSending] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const unreadTotal = conversations.reduce((n, c) => n + (c.unreadForStaff > 0 ? 1 : 0), 0)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    return conversations.filter(
      (c) =>
        (!unreadOnly || c.unreadForStaff > 0) &&
        (!q ||
          (c.patientName ?? "").toLowerCase().includes(q) ||
          (digits.length > 0 && c.phone.includes(digits)) ||
          (c.lastText ?? "").toLowerCase().includes(q))
    )
  }, [conversations, query, unreadOnly])

  const openConversation = async (c: ConversationSummary) => {
    setActive(c)
    setThread([])
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
    setRefreshing(true)
    const [cRes, tRes] = await Promise.all([
      fetchConversationsAction(),
      active ? fetchThreadAction(active.phone) : Promise.resolve({ messages: undefined }),
    ])
    if (cRes.conversations) setConversations(cRes.conversations)
    if (tRes.messages) setThread(tRes.messages)
    setRefreshing(false)
  }

  // Light, visibility-aware polling — a little faster while a chat is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, active ? 20000 : 45000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.phone])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [thread])

  // Grow the composer with its text, up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [reply])

  const send = () => {
    if (!active || !reply.trim()) return
    const text = reply.trim()
    startSending(async () => {
      const res = await sendInboxReplyAction(active.phone, text)
      if (res.success) {
        setReply("")
        const at = new Date().toISOString()
        setThread((prev) => [...prev, { id: `local-${Date.now()}`, direction: "OUT", kind: "text", body: text, at, meta: "you" }])
        setConversations((prev) => [
          { ...active, lastText: text, lastDirection: "OUT", lastAt: at },
          ...prev.filter((x) => x.phone !== active.phone),
        ])
      } else {
        toast.error(res.error ?? "Failed to send")
      }
    })
  }

  // Thread with day separators.
  const items: ({ kind: "day"; label: string; key: string } | { kind: "msg"; m: ThreadMessage })[] = []
  let lastDay = ""
  for (const m of thread) {
    const label = dayLabel(m.at)
    if (label !== lastDay) {
      items.push({ kind: "day", label, key: `d-${m.id}` })
      lastDay = label
    }
    items.push({ kind: "msg", m })
  }

  return (
    <div className="flex h-[calc(100dvh-150px)] min-h-[420px] overflow-hidden rounded-xl border border-[#E0E3E5] bg-white md:h-[calc(100vh-260px)]">
      {/* ── Chat list (full width on phones until a chat is open) ── */}
      <div className={`${active ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#E0E3E5] md:w-80 md:flex-shrink-0`}>
        <div className="flex items-center justify-between bg-[#075E54] px-3 py-2.5 text-white">
          <span className="text-base font-semibold">Chats</span>
          <button onClick={refresh} className="rounded-full p-1.5 hover:bg-white/10" title="Refresh" aria-label="Refresh chats">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="space-y-2 border-b border-[#F0F2F4] p-2">
          <div className="flex items-center gap-2 rounded-full bg-[#F0F2F5] px-3 py-1.5">
            <Search className="h-4 w-4 text-gray-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, number or message"
              className="w-full bg-transparent text-sm outline-none" aria-label="Search chats" />
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setUnreadOnly(false)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${!unreadOnly ? "bg-[#D9FDD3] text-[#075E54]" : "bg-[#F0F2F5] text-gray-600"}`}>
              All
            </button>
            <button type="button" onClick={() => setUnreadOnly(true)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${unreadOnly ? "bg-[#D9FDD3] text-[#075E54]" : "bg-[#F0F2F5] text-gray-600"}`}>
              Unread{unreadTotal ? ` (${unreadTotal})` : ""}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-500">{conversations.length ? "No chats match." : "No conversations yet."}</p>
          ) : (
            shown.map((c) => (
              <button
                key={c.phone}
                onClick={() => openConversation(c)}
                className={`flex w-full items-center gap-3 border-b border-[#F0F2F4] px-3 py-3 text-left transition-colors hover:bg-[#F5F6F6] ${active?.phone === c.phone ? "bg-[#F0F2F5]" : ""}`}
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#DFE5E7] text-sm font-semibold text-[#54656F]">
                  {initials(c) ?? <User className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-medium text-gray-900">{c.patientName ?? fmtPhone(c.phone)}</span>
                    <span className={`flex-shrink-0 text-[11px] ${c.unreadForStaff > 0 ? "font-semibold text-[#25D366]" : "text-gray-500"}`}>{fmtListTime(c.lastAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-[13px] text-gray-500">
                      {c.lastDirection === "OUT" && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#53BDEB]" />}
                      <span className="truncate">{c.lastText ?? "—"}</span>
                    </span>
                    {c.unreadForStaff > 0 && (
                      <span className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-white">
                        {c.unreadForStaff}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-[#F0F2F5] text-gray-500">
            <MessageSquare className="h-9 w-9" />
            <p className="text-sm">Select a chat to view messages</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-[#075E54] px-2 py-2 text-white">
              <button type="button" onClick={() => setActive(null)} className="rounded-full p-1.5 hover:bg-white/10 md:hidden" aria-label="Back to chats">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                {initials(active) ?? <User className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{active.patientName ?? fmtPhone(active.phone)}</p>
                {active.patientName && <p className="truncate text-[11px] text-white/75">{fmtPhone(active.phone)}</p>}
              </div>
              {active.patientId && (
                <Link href={`/patients/${active.patientId}`} className="rounded-full p-2 hover:bg-white/10" title="Open patient" aria-label="Open patient profile">
                  <User className="h-4 w-4" />
                </Link>
              )}
              <a href={`tel:+${active.phone}`} className="rounded-full p-2 hover:bg-white/10" title="Call" aria-label="Call">
                <Phone className="h-4 w-4" />
              </a>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-[#EFEAE2] px-3 py-3 sm:px-6">
              {loadingThread ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#075E54]" /></div>
              ) : items.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">No messages.</p>
              ) : (
                items.map((it) =>
                  it.kind === "day" ? (
                    <div key={it.key} className="flex justify-center py-2">
                      <span className="rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm">{it.label}</span>
                    </div>
                  ) : (
                    <div key={it.m.id} className={`flex ${it.m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14px] leading-snug shadow-sm sm:max-w-[70%] ${it.m.direction === "OUT" ? "rounded-tr-none bg-[#D9FDD3]" : "rounded-tl-none bg-white"}`}>
                        <span className="whitespace-pre-wrap break-words text-gray-900">{it.m.body}</span>
                        <span className="float-right ml-2 mt-1.5 flex items-center gap-0.5 text-[10px] text-gray-500">
                          {it.m.meta && it.m.meta !== "you" ? `${it.m.meta.replace(/_/g, " ").toLowerCase()} · ` : ""}
                          {new Date(it.m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          {it.m.direction === "OUT" && <Check className="h-3 w-3 text-[#53BDEB]" />}
                        </span>
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <div className="flex items-end gap-2 bg-[#F0F2F5] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <textarea
                ref={inputRef}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends on a keyboard; on phones Enter adds a line and the button sends.
                  if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Message"
                title="Free replies are allowed within 24 hours of the patient's last message"
                rows={1}
                className="max-h-[120px] flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-2.5 text-[15px] outline-none"
                aria-label="Reply"
              />
              <button
                onClick={send}
                disabled={sending || !reply.trim()}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white disabled:opacity-50"
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
