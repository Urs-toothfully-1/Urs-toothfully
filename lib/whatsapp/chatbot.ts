/**
 * WhatsApp auto-reply bot — pure decision logic (no I/O, unit-testable).
 *
 * Design (per clinic's choice): "Menu + staff handoff", greeting on the FIRST
 * message in a 24h window only.
 *  - First inbound in 24h  → greeting + numbered menu (after-hours note if closed)
 *  - A menu number (1/2/3) → canned answer
 *  - Anything else, already greeted → stay quiet (a human handles it)
 *  - During clinic hours ANY inbound flags the chat for staff to take over.
 */

const EMERGENCY = "7890008331"

export type BotAction = "GREETED_MENU" | "CANNED_REPLY" | "IGNORED"

export interface BotDecision {
  replyText: string | null // null = send nothing
  action: BotAction
  needsStaff: boolean // true = surface to reception to take over
}

/** Clinic hours in IST: Mon–Sat 10:30–20:30, Sun 10:00–14:30, Thursday off. */
export function isClinicOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const wd = parts.find((p) => p.type === "weekday")?.value ?? ""
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  const mins = hh * 60 + mm
  if (wd === "Thu") return false
  if (wd === "Sun") return mins >= 10 * 60 && mins <= 14 * 60 + 30
  return mins >= 10 * 60 + 30 && mins <= 20 * 60 + 30 // Mon,Tue,Wed,Fri,Sat
}

const CLOSED_NOTE =
  `🕙 We're currently closed. Timings: Mon–Sat 10:30 AM–8:30 PM · Sun 10 AM–2:30 PM (Thursday off). ` +
  `We'll reply during working hours. For emergencies call ${EMERGENCY}.`

function menu(firstName?: string, open = true): string {
  const hi = firstName ? `👋 Welcome back, ${firstName}!` : "👋 Welcome to Ur's Toothfully!"
  const body =
    `${hi} How can we help?\n\n` +
    `Reply with a number:\n` +
    `1️⃣ Book an appointment\n` +
    `2️⃣ Clinic timings & address\n` +
    `3️⃣ Talk to our reception\n\n` +
    `Or just type your question and our team will reply.`
  return open ? body : `${body}\n\n${CLOSED_NOTE}`
}

const ANSWER_BOOK =
  `📅 To book, reply with your preferred day & time and your concern — our reception will confirm. ` +
  `You can also call ${EMERGENCY}.`
const ANSWER_INFO =
  `🕙 Timings: Mon–Sat 10:30 AM–8:30 PM · Sun 10 AM–2:30 PM · Thursday off.\n` +
  `📍 Branches: Salt Lake · New Alipore · Outram. Call ${EMERGENCY} for directions.`
const ANSWER_RECEPTION =
  `🙏 Thanks — our reception team will get back to you shortly during working hours. For urgent matters call ${EMERGENCY}.`

/** Maps free text to a menu choice: "1"/"book", "2"/"timing"/"address", "3"/"reception"/"talk". */
function menuChoice(text: string): 1 | 2 | 3 | null {
  const t = text.trim().toLowerCase()
  if (t === "1" || /\bbook|appointment\b/.test(t)) return 1
  if (t === "2" || /\btiming|hours|address|location|where\b/.test(t)) return 2
  if (t === "3" || /\breception|talk|human|call\b/.test(t)) return 3
  return null
}

export function decideBotReply(input: {
  text: string
  clinicOpen: boolean
  alreadyGreetedIn24h: boolean
  firstName?: string
}): BotDecision {
  const { text, clinicOpen, alreadyGreetedIn24h, firstName } = input
  const choice = menuChoice(text)

  if (choice === 1) return { replyText: ANSWER_BOOK, action: "CANNED_REPLY", needsStaff: true }
  if (choice === 2) return { replyText: ANSWER_INFO, action: "CANNED_REPLY", needsStaff: false }
  if (choice === 3) return { replyText: ANSWER_RECEPTION, action: "CANNED_REPLY", needsStaff: true }

  // Not a menu selection.
  if (!alreadyGreetedIn24h) {
    return { replyText: menu(firstName, clinicOpen), action: "GREETED_MENU", needsStaff: clinicOpen }
  }
  // Already greeted in this window → don't spam; a human handles it during hours.
  return { replyText: null, action: "IGNORED", needsStaff: clinicOpen }
}

// demo(): runnable self-check for the decision logic.
if (typeof module !== "undefined" && require.main === module) {
  const a = decideBotReply({ text: "hello", clinicOpen: true, alreadyGreetedIn24h: false })
  console.assert(a.action === "GREETED_MENU" && a.replyText?.includes("1️⃣") && a.needsStaff, "first msg open → menu + staff")
  const b = decideBotReply({ text: "hi", clinicOpen: false, alreadyGreetedIn24h: false })
  console.assert(b.action === "GREETED_MENU" && b.replyText?.includes("closed") && !b.needsStaff, "first msg closed → menu + closed note, no staff")
  const c = decideBotReply({ text: "1", clinicOpen: true, alreadyGreetedIn24h: true })
  console.assert(c.action === "CANNED_REPLY" && c.replyText === ANSWER_BOOK && c.needsStaff, "1 → book answer + staff")
  const d = decideBotReply({ text: "2", clinicOpen: true, alreadyGreetedIn24h: true })
  console.assert(d.action === "CANNED_REPLY" && d.replyText === ANSWER_INFO && !d.needsStaff, "2 → info, no staff")
  const e = decideBotReply({ text: "thanks", clinicOpen: true, alreadyGreetedIn24h: true })
  console.assert(e.action === "IGNORED" && e.replyText === null && e.needsStaff, "already greeted, open → quiet but staff")
  const f = decideBotReply({ text: "ok", clinicOpen: false, alreadyGreetedIn24h: true })
  console.assert(f.action === "IGNORED" && f.replyText === null && !f.needsStaff, "already greeted, closed → quiet")
  console.log("chatbot decision OK")
}
