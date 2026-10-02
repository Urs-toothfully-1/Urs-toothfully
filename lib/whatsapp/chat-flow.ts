/**
 * Rule-based questionnaire chatbot for Ur's Toothfully (no AI). A menu/decision
 * tree encoded from the clinic's script: Patient/Doctor → services → per-service
 * info → book → hand to reception; plus tips, contact, FAQs.
 *
 * Each step can carry WhatsApp interactive UI — reply buttons (≤3), a list menu
 * (≤10 rows) or a link button — sent as free session messages.
 *
 * Strict scope: every step accepts only its own options (tap, number or
 * keyword). The single free-text step (patient name) is validated. Anything
 * else re-asks the same step. "back" returns to the previous screen (a per-chat
 * history stack), "menu"/"0" opens the main menu, "hi" restarts.
 *
 * Pure logic (no I/O) so it's unit-testable. State (current node + collected
 * answers + history) is persisted per phone by chatbot.service via WhatsAppChatState.
 */

const PHONE1 = "7890008331"
const PHONE2 = "9748038280"

export interface FlowData {
  [k: string]: string
}

export interface UIItem {
  id: string
  title: string // buttons ≤20 chars, list rows ≤24
  description?: string // list rows only, ≤72
}
export type NodeUI =
  | { kind: "buttons"; items: UIItem[] }
  | { kind: "list"; button: string; items: UIItem[] }
  | { kind: "cta"; label: string; url: string }

/** One outgoing bot message: text plus optional interactive UI and footer. */
export interface OutMsg {
  text: string
  ui?: NodeUI
  footer?: string
}

interface Option {
  id: string // interactive reply id; also accepted as typed input
  title: string
  description?: string
  keys?: string[] // extra lowercased typed inputs that select this option
  next: string // node id, or BACK for "previous screen"
  set?: FlowData // fields to record when chosen
  hidden?: boolean // selectable by typing, but not shown as a button/row
  when?: (d: FlowData) => boolean // only offered (and accepted) when true
}

type Validated = { ok: string } | { err: string }
interface FlowNode {
  message: string | ((d: FlowData) => string)
  options?: Option[]
  ui?: "buttons" | "list" // how to render the visible options
  listButton?: string // label of the list-menu button
  cta?: { label: string; url: string } // single link button
  // Free-text step: `validate` returns the value to store or a specific error;
  // `error` is shown when a stray button is tapped instead of typing.
  collect?: { field: string; next: string; validate: (v: string, now: Date) => Validated; error: string }
  handoff?: boolean // flag the chat for reception
  noFooter?: boolean
}

export interface FlowStep {
  messages: OutMsg[]
  node: string
  data: FlowData
  handoff: boolean
}

const BACK = "__back"
const FOOTER = "↩️ Type back · 🏠 Type menu"

const MENU: Option = { id: "menu", title: "🏠 Main menu", keys: ["0", "menu", "main menu"], next: "patient_menu" }
const BACK_OPT: Option = { id: "back", title: "⬅️ Back", keys: ["back"], next: BACK }

/** Letters in any script (so Bengali/Hindi names work), spaces, dot, apostrophe, hyphen. */
const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]{1,49}$/u
const NOT_A_NAME = new Set(["back", "menu", "main menu", "yes", "no", "ok", "okay", "hi", "hello", "hey", "book", "today", "tomorrow"])

const NAME_ERR = "⚠️ Please type a valid full name (letters only), e.g. *Ramesh Kumar*."

function validateName(v: string): Validated {
  const t = v.trim().replace(/\s+/g, " ")
  if (!NAME_RE.test(t) || NOT_A_NAME.has(t.toLowerCase())) return { err: NAME_ERR }
  if ((t.match(/\p{L}/gu) ?? []).length < 2) return { err: NAME_ERR }
  return { ok: t }
}

// ── Custom date parsing (Indian DD/MM order) ──────────────────────
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_DAYS_AHEAD = 90
const DATE_ERR = "⚠️ Please type a date like *12/10* or *12 Oct* (day first)."

function monthIndex(s: string): number | null {
  if (s.length < 3) return null
  const i = MONTHS.findIndex((m) => m.startsWith(s))
  return i >= 0 ? i : null
}

/** Parses "12/10", "12-10-2026", "12 Oct", "Oct 12th 2026"… → {d, m(0-based), y?} or null. */
function parseDateParts(raw: string): { d: number; m: number; y?: number } | null {
  const t = raw.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ").replace(/\s+/g, " ")
  const year = (s?: string) => (s ? (Number(s) < 100 ? 2000 + Number(s) : Number(s)) : undefined)
  let r = t.match(/^(\d{1,2})[/\-. ](\d{1,2})(?:[/\-. ](\d{2}|\d{4}))?$/)
  if (r) return { d: Number(r[1]), m: Number(r[2]) - 1, y: year(r[3]) }
  r = t.match(/^(\d{1,2}) ([a-z]{3,9})(?: (\d{2}|\d{4}))?$/)
  if (r) { const m = monthIndex(r[2]); return m === null ? null : { d: Number(r[1]), m, y: year(r[3]) } }
  r = t.match(/^([a-z]{3,9}) (\d{1,2})(?: (\d{2}|\d{4}))?$/)
  if (r) { const m = monthIndex(r[1]); return m === null ? null : { d: Number(r[2]), m, y: year(r[3]) } }
  return null
}

function formatDay(dt: Date): string {
  return `${WD3[dt.getDay()]}, ${dt.getDate()} ${MON3[dt.getMonth()]} ${dt.getFullYear()}`
}

function validateDate(v: string, now: Date): Validated {
  const p = parseDateParts(v)
  if (!p || p.m < 0 || p.m > 11) return { err: DATE_ERR }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const make = (y: number) => {
    const dt = new Date(y, p.m, p.d)
    return dt.getMonth() === p.m && dt.getDate() === p.d ? dt : null // rejects 31/02 etc.
  }
  let dt = make(p.y ?? today.getFullYear())
  if (!dt) return { err: DATE_ERR }
  // No year typed and the date already passed → assume next year (e.g. "5/1" in December).
  if (p.y === undefined && dt < today) dt = make(today.getFullYear() + 1) ?? dt
  const daysAhead = Math.round((dt.getTime() - today.getTime()) / 86_400_000)
  if (daysAhead < 0) return { err: "⚠️ That date has already passed — please type an upcoming date." }
  if (daysAhead > MAX_DAYS_AHEAD) return { err: "⚠️ Please choose a date within the next 3 months." }
  if (dt.getDay() === 4) return { err: "🙏 We're closed on Thursdays — please type another date." }
  return { ok: formatDay(dt) }
}

const isSunday = (d: FlowData) => Boolean(d.day?.startsWith("Sun,"))

function service(title: string, blurb: string): FlowNode {
  return {
    message: `*${title}*\n\n${blurb}`,
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book consultation", keys: ["yes", "consultation"], next: "book_day", set: { service: title } },
      { id: "services", title: "🦷 Other services", next: "services_menu" },
      MENU,
    ],
  }
}

export const FLOW: Record<string, FlowNode> = {
  root: {
    message:
      "Hello! 👋 Welcome to *Ur's Toothfully* — Full Mouth Rehabilitation & Implant Centre.\n" +
      "We're dedicated to a brighter, healthier smile for you! 😊\n\nHow can we help you today?",
    ui: "buttons",
    noFooter: true,
    options: [
      { id: "patient", title: "🧑 I'm a Patient", keys: ["patients"], next: "patient_menu" },
      { id: "doctor", title: "🩺 I'm a Doctor", keys: ["doctors"], next: "doctor_menu" },
    ],
  },

  patient_menu: {
    message: "What would you like to do? 👇",
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book appointment", keys: ["appointment"], next: "book_day", set: { service: "General appointment" } },
      { id: "services", title: "🦷 Our services", keys: ["service"], next: "services_menu" },
      { id: "more", title: "ℹ️ More info", keys: ["info", "help"], next: "more_menu" },
    ],
  },

  more_menu: {
    message: "Here's what else I can help with 👇",
    ui: "list",
    listButton: "Choose",
    options: [
      { id: "tips", title: "💡 Dental tips", description: "Simple habits for a healthy smile", next: "tips" },
      { id: "contact", title: "📍 Contact & locations", description: "Phone, branches & clinic hours", keys: ["location", "locations"], next: "contact" },
      { id: "faqs", title: "❓ FAQs", description: "Hours, emergencies, payments", keys: ["faq"], next: "faqs" },
      BACK_OPT,
      MENU,
    ],
  },

  services_menu: {
    message: "Our specialised treatments 🦷\nTap *View services* to learn more about any of them.",
    ui: "list",
    listButton: "View services",
    options: [
      { id: "svc_crown", title: "One-Visit Crown", description: "CEREC crown designed & fitted in one visit", next: "svc_crown" },
      { id: "svc_implants", title: "Dental Implants", description: "Permanent replacement for missing teeth", next: "svc_implants" },
      { id: "svc_allon4", title: "Teeth in a Day", description: "All-on-4/6 fixed teeth in a single day", next: "svc_allon4" },
      { id: "svc_rct", title: "Root Canal (Microscope)", description: "Precise, comfortable microscopic RCT", next: "svc_rct" },
      { id: "svc_fmr", title: "Full Mouth Rehab", description: "Restore function & looks of your whole mouth", next: "svc_fmr" },
      { id: "svc_braces", title: "Braces & Invisalign", description: "Straighten your smile, visible or clear", next: "svc_braces" },
      { id: "svc_smile", title: "Smile Designing", description: "Cosmetic makeover for your perfect smile", next: "svc_smile" },
      { id: "svc_fillings", title: "Dental Fillings", description: "Tooth-coloured repairs for cavities", next: "svc_fillings" },
      { id: "svc_cleaning", title: "Cleaning & Whitening", description: "Fresh, healthy and brighter teeth", next: "svc_cleaning" },
      { id: "svc_tmj", title: "TMJ Disorder", description: "Relief from jaw pain & clicking", next: "svc_tmj" },
    ],
  },

  svc_crown: service(
    "One-Visit Crown (CEREC)",
    "Get a custom crown designed, milled and fitted in a single visit using CEREC technology — a digital scan creates a 3D model, the crown is milled in-office and cemented the same day. As strong and natural-looking as traditional crowns."
  ),
  svc_implants: service(
    "Dental Implants",
    "A permanent solution for missing teeth — a titanium post integrates with your jawbone and supports a crown that looks and works like a natural tooth."
  ),
  svc_allon4: service(
    "Fixed Teeth in a Day (All-on-4/6)",
    "A complete set of fixed teeth in a single day. We place 4–6 implants per arch and attach a temporary set the same day, so you leave with a new smile immediately. Permanent teeth follow once the implants integrate."
  ),
  svc_rct: service(
    "Root Canal Under Microscope",
    "Root canal treatment performed with a high-powered microscope for greater precision — better visibility of complex canals, higher success rate, and a more comfortable experience."
  ),
  svc_fmr: service(
    "Full Mouth Rehabilitation",
    "A comprehensive plan to restore the function, health and appearance of your whole mouth — combining implants, crowns, bridges, veneers and, if needed, orthodontics, tailored to you."
  ),
  svc_braces: service(
    "Braces & Invisalign",
    "Straighten your teeth with traditional braces (great for complex cases) or clear, removable Invisalign aligners (discreet, for mild–moderate cases). We'll help you choose in a consultation."
  ),
  svc_smile: service(
    "Smile Designing",
    "A cosmetic plan to enhance the shape, colour and alignment of your smile — using veneers, whitening, crowns and more, with digital imaging to preview your new smile."
  ),
  svc_fillings: service(
    "Dental Fillings",
    "Restore teeth damaged by decay or cracks. We offer tooth-coloured composite, glass-ionomer and ceramic fillings. The procedure is quick and comfortable with local anaesthesia."
  ),
  svc_cleaning: service(
    "Cleaning & Teeth Whitening",
    "Professional cleaning removes plaque, tartar and stains to prevent gum disease and cavities. Whitening is available as in-office (immediate results) or take-home kits (gradual)."
  ),
  svc_tmj: service(
    "TMJ Disorder",
    "Pain or clicking in the jaw joint, headaches or difficulty moving your jaw can signal TMJ disorder. Treatments include night guards/splints, physiotherapy, medication and bite adjustment."
  ),

  // ── Booking flow (choices only, then a validated name) ─────────
  book_day: {
    message: "Great! 📅 Which day would you prefer?\n\nTap *Choose day* below.",
    ui: "list",
    listButton: "Choose day",
    options: [
      { id: "d_today", title: "Today", next: "book_slot", set: { day: "Today" } },
      { id: "d_tomorrow", title: "Tomorrow", next: "book_slot", set: { day: "Tomorrow" } },
      { id: "d_dayafter", title: "Day after tomorrow", next: "book_slot", set: { day: "Day after tomorrow" } },
      { id: "d_weekend", title: "This weekend", next: "book_slot", set: { day: "This weekend" } },
      { id: "d_nextweek", title: "Next week", next: "book_slot", set: { day: "Next week" } },
      { id: "d_custom", title: "📆 Pick a date", description: "Type any date that suits you", keys: ["date", "custom"], next: "book_date" },
      BACK_OPT,
      MENU,
    ],
  },
  book_date: {
    message:
      "📆 Please type your preferred *date*, e.g. *12/10* or *12 Oct*.\n\n" +
      "We're open Mon–Sat, Sunday till 2:30 PM, and closed on Thursdays.",
    ui: "buttons",
    options: [BACK_OPT, MENU],
    collect: {
      field: "day",
      next: "book_slot",
      validate: validateDate,
      error: DATE_ERR,
    },
  },
  book_slot: {
    message: (d) =>
      `${d.day ? `*${d.day}* — ` : ""}what time suits you? ⏰\n\nTap *Choose time* below.` +
      (isSunday(d) ? "\n\n_We close at 2:30 PM on Sundays, so mornings only._" : ""),
    ui: "list",
    listButton: "Choose time",
    options: [
      { id: "s_morning", title: "Morning", description: "10 AM – 1 PM", next: "book_name", set: { slot: "Morning (10 AM–1 PM)" } },
      { id: "s_afternoon", title: "Afternoon", description: "1 PM – 4 PM", next: "book_name", set: { slot: "Afternoon (1–4 PM)" }, when: (d) => !isSunday(d) },
      { id: "s_evening", title: "Evening", description: "4 PM – 7:30 PM", next: "book_name", set: { slot: "Evening (4–7:30 PM)" }, when: (d) => !isSunday(d) },
      BACK_OPT,
      MENU,
    ],
  },
  book_name: {
    message: "Perfect 👍 Please type the patient's *full name* ✍️",
    ui: "buttons",
    options: [BACK_OPT, MENU],
    collect: {
      field: "name",
      next: "book_confirm",
      validate: validateName,
      error: NAME_ERR,
    },
  },
  book_confirm: {
    message: (d) =>
      `Thank you${d.name ? `, ${d.name}` : ""}! 🙏 Our reception team will contact you shortly to confirm your ` +
      `${d.service && d.service !== "General appointment" ? `*${d.service}* ` : ""}appointment` +
      `${d.day ? ` for *${d.day}${d.slot ? `, ${d.slot}` : ""}*` : ""}.\n\nFor anything urgent, call ${PHONE1}.`,
    handoff: true,
    ui: "buttons",
    noFooter: true,
    options: [MENU],
  },

  // ── Static info ───────────────────────────────────────────────
  tips: {
    message:
      "🦷 *Tips for a healthy smile:*\n" +
      "• Brush twice a day with fluoride toothpaste\n• Floss daily\n• Visit us every 6 months for a check-up\n" +
      "• Limit sugary snacks",
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book check-up", keys: ["checkup"], next: "book_day", set: { service: "Check-up" } },
      BACK_OPT,
      MENU,
    ],
  },
  contact: {
    message:
      `📞 *Contact us:* +91 ${PHONE1} / ${PHONE2}\n\n` +
      "📍 *Locations:* New Alipore · Park Street · Salt Lake\n" +
      "🕙 *Hours:* Mon–Sat 10 AM–7:30 PM (Thu closed) · Sun 10 AM–2:30 PM",
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book appointment", next: "book_day", set: { service: "General appointment" } },
      BACK_OPT,
      MENU,
    ],
  },
  faqs: {
    message: "❓ *FAQs* — tap a question 👇",
    ui: "buttons",
    options: [
      { id: "faq_hours", title: "🕙 Clinic hours", keys: ["hours"], next: "faq_hours" },
      { id: "faq_emergency", title: "🚑 Emergencies", keys: ["emergency"], next: "faq_emergency" },
      { id: "faq_payment", title: "💳 Payments", keys: ["payment"], next: "faq_payment" },
    ],
  },
  faq_hours: {
    message: "🕙 Mon–Sat 10 AM–7:30 PM (closed Thursday) · Sun 10 AM–2:30 PM.",
    ui: "buttons",
    options: [{ id: "faqs", title: "❓ More FAQs", next: "faqs" }, MENU],
  },
  faq_emergency: {
    message: `🚑 Yes — for dental emergencies call us at +91 ${PHONE1}.`,
    ui: "buttons",
    options: [{ id: "faqs", title: "❓ More FAQs", next: "faqs" }, MENU],
  },
  faq_payment: {
    message: "💳 We accept cash, credit/debit cards, and online payments.",
    ui: "buttons",
    options: [{ id: "faqs", title: "❓ More FAQs", next: "faqs" }, MENU],
  },

  // ── Doctors ───────────────────────────────────────────────────
  doctor_menu: {
    message:
      "🧑‍⚕️ *Ur's Toothfully Digital Dental Lab* (New Alipore, Kolkata) — a full-service lab run by dentists, " +
      "prosthodontists and certified technicians, serving doctors across Kolkata since 2018.\n\n" +
      `For lab enquiries call +91 ${PHONE1}.`,
    cta: { label: "Visit Lab Website", url: "https://digitaldentalab.in/" },
  },
}

const RESET_WORDS = ["hi", "hello", "hey", "start", "restart"]
const HIST_MAX = 20

function availableOptions(node: FlowNode, data: FlowData): Option[] {
  return (node.options ?? []).filter((o) => !o.when || o.when(data))
}
function visibleOptions(node: FlowNode, data: FlowData): Option[] {
  return availableOptions(node, data).filter((o) => !o.hidden)
}

function render(nodeId: string, data: FlowData): FlowStep {
  const node = FLOW[nodeId] ?? FLOW.root
  const text = typeof node.message === "function" ? node.message(data) : node.message
  let ui: NodeUI | undefined
  if (node.cta) {
    ui = { kind: "cta", label: node.cta.label, url: node.cta.url }
  } else if (node.ui) {
    const items = visibleOptions(node, data).map((o) => ({ id: o.id, title: o.title, description: o.description }))
    ui = node.ui === "list" ? { kind: "list", button: node.listButton ?? "Options", items } : { kind: "buttons", items }
  }
  const footer = node.noFooter ? undefined : FOOTER
  return { messages: [{ text, ui, footer }], node: nodeId, data, handoff: Boolean(node.handoff) }
}

function reprompt(nodeId: string, data: FlowData, note: string): FlowStep {
  const r = render(nodeId, data)
  r.messages[0] = { ...r.messages[0], text: `${note}\n\n${r.messages[0].text}` }
  r.handoff = false
  return r
}

function matchOption(node: FlowNode, data: FlowData, low: string, replyId?: string): Option | undefined {
  const all = availableOptions(node, data)
  const byId = all.find((o) => (replyId && o.id === replyId) || (!replyId && (o.id === low || o.keys?.includes(low))))
  if (byId) return byId
  if (!replyId && /^\d+$/.test(low)) return visibleOptions(node, data)[Number(low) - 1] // typed number = position
  return undefined
}

/**
 * Advances the flow one step. `rawInput` is what the patient typed (or the
 * tapped button's title); `replyId` is the tapped button/list row id, if any.
 */
export function stepFlow(
  currentNode: string,
  data: FlowData,
  rawInput: string,
  replyId?: string,
  now: Date = new Date()
): FlowStep {
  const input = rawInput.trim()
  const low = input.toLowerCase()
  const node = FLOW[currentNode] ?? FLOW.root
  const hist = data._hist ? data._hist.split(">") : []

  const forward = (next: string, nd: FlowData) =>
    render(next, { ...nd, _hist: [...hist, currentNode].slice(-HIST_MAX).join(">") })
  const goBack = () => {
    const h = [...hist]
    const prev = h.pop() ?? "root"
    return render(prev, { ...data, _hist: h.join(">") })
  }

  // Global navigation — works on every step, including the name step.
  if (!replyId && RESET_WORDS.includes(low)) return render("root", {})
  if (replyId === "back" || (!replyId && low === "back")) return goBack()
  if (replyId === "menu" || (!replyId && ["menu", "main menu", "0"].includes(low))) {
    return currentNode === "patient_menu" ? render("patient_menu", data) : forward("patient_menu", data)
  }

  // Free-text steps (custom date, name): accept only a valid value, never a stray tap.
  if (node.collect) {
    if (replyId) return reprompt(currentNode, data, node.collect.error)
    const res = node.collect.validate(input, now)
    if ("err" in res) return reprompt(currentNode, data, res.err)
    return forward(node.collect.next, { ...data, [node.collect.field]: res.ok })
  }

  const opt = node.options ? matchOption(node, data, low, replyId) : undefined
  if (opt) {
    if (opt.next === BACK) return goBack()
    return forward(opt.next, opt.set ? { ...data, ...opt.set } : data)
  }

  return reprompt(currentNode, data, "Sorry, I can only help with the options below — please tap one 👇")
}

/** Entry message for a brand-new / reset conversation. */
export function startFlow(): FlowStep {
  return render("root", {})
}

/** Plain-text version of a message (fallback send + inbox log). */
export function toPlainText(m: OutMsg): string {
  let out = m.text
  if (m.ui?.kind === "cta") out += `\n\n🔗 ${m.ui.url}`
  else if (m.ui) out += `\n\n${m.ui.items.map((it, i) => `${i + 1}. ${it.title}`).join("\n")}`
  if (m.footer) out += `\n\n${m.footer}`
  return out
}

// demo(): runnable self-check — taps, back navigation, strict scope.
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  let s = startFlow()
  ok(s.node === "root" && s.messages[0].ui?.kind === "buttons" && !s.messages[0].footer, "start → root, no footer")
  s = stepFlow(s.node, s.data, "🧑 I'm a Patient", "patient")
  ok(s.node === "patient_menu" && s.messages[0].footer === FOOTER, "patient_menu has footer")
  s = stepFlow(s.node, s.data, "📅 Book appointment", "book")
  ok(s.node === "book_day" && s.messages[0].ui?.kind === "list", "book → day list")

  // Free text on a choice step is rejected (the reported bug)
  const bad = stepFlow(s.node, s.data, "Saturday 5 PM")
  ok(bad.node === "book_day" && bad.messages[0].text.startsWith("Sorry") && !bad.data.day, "free text rejected on day step")
  // "Back" is navigation, never stored as an answer
  const back1 = stepFlow(s.node, s.data, "Back")
  ok(back1.node === "patient_menu" && !back1.data.day, "typed Back → previous screen")

  s = stepFlow(s.node, s.data, "Tomorrow", "d_tomorrow")
  ok(s.node === "book_slot" && s.data.day === "Tomorrow", "tap Tomorrow")
  s = stepFlow(s.node, s.data, "Evening", "s_evening")
  ok(s.node === "book_name" && s.data.slot === "Evening (4–7:30 PM)", "tap Evening")

  const backTap = stepFlow(s.node, s.data, "⬅️ Back", "back")
  ok(backTap.node === "book_slot", "tap Back on name step → time step")
  ok(stepFlow(s.node, s.data, "back").node === "book_slot", "typed back on name step → time step")
  ok(stepFlow(s.node, s.data, "12345").node === "book_name", "digits rejected as name")
  ok(stepFlow(s.node, s.data, "ok").node === "book_name", "filler word rejected as name")
  ok(stepFlow(s.node, s.data, "Morning", "s_morning").node === "book_name", "stray tap rejected on name step")
  ok(stepFlow(s.node, s.data, "সুমন দাস").node === "book_confirm", "Bengali name accepted")

  s = stepFlow(s.node, s.data, "  ramesh   kumar ")
  ok(s.node === "book_confirm" && s.handoff && s.data.name === "ramesh kumar", "name → confirm + handoff")
  ok(s.messages[0].text.includes("Tomorrow, Evening"), "confirm shows day + slot")

  // Back across several screens
  let n = stepFlow("root", {}, "1")
  n = stepFlow(n.node, n.data, "2") // services
  n = stepFlow(n.node, n.data, "6") // braces
  ok(n.node === "svc_braces", "typed path to braces")
  n = stepFlow(n.node, n.data, "back")
  ok(n.node === "services_menu", "back → services")
  n = stepFlow(n.node, n.data, "back")
  ok(n.node === "patient_menu", "back → patient menu")
  n = stepFlow(n.node, n.data, "back")
  ok(n.node === "root", "back → root")

  // Custom date — "today" pinned to Fri 2 Oct 2026
  const NOW = new Date(2026, 9, 2)
  const cd = stepFlow("book_day", { service: "Check-up" }, "📆 Pick a date", "d_custom", NOW)
  ok(cd.node === "book_date", "Pick a date → book_date")
  const date = (txt: string) => stepFlow("book_date", cd.data, txt, undefined, NOW)
  for (const f of ["12/10", "12-10-26", "12.10.2026", "12 Oct", "12 october", "Oct 12th", "october 12, 2026"]) {
    const r = date(f)
    ok(r.node === "book_slot" && r.data.day === "Mon, 12 Oct 2026", `parses "${f}"`)
  }
  ok(date("2/10").data.day === "Fri, 2 Oct 2026", "today accepted")
  ok(date("8 Oct").messages[0].text.includes("closed on Thursdays"), "Thursday rejected")
  ok(date("31/02").node === "book_date", "impossible date rejected")
  ok(date("1/10/2026").messages[0].text.includes("already passed"), "past date rejected")
  ok(date("20/3/2027").messages[0].text.includes("3 months"), "too far ahead rejected")
  ok(date("next friday maybe").messages[0].text.includes("12/10"), "non-date rejected with example")
  ok(stepFlow("book_date", cd.data, "Today", "d_today", NOW).node === "book_date", "stray tap rejected on date step")
  ok(date("back").node === "book_day", "back from date step → day list")

  const sun = date("4 Oct")
  ok(sun.node === "book_slot" && sun.data.day === "Sun, 4 Oct 2026", "Sunday accepted")
  const sunUi = sun.messages[0].ui
  ok(sunUi?.kind === "list" && sunUi.items.map((i) => i.id).join() === "s_morning,back,menu", "Sunday → mornings only")
  ok(stepFlow(sun.node, sun.data, "Evening", "s_evening", NOW).node === "book_slot", "Sunday evening tap rejected")
  const wk = date("12/10")
  ok(wk.messages[0].ui?.kind === "list" && wk.messages[0].ui.items.length === 5, "weekday → all 3 slots + back/menu")

  ok(stepFlow("services_menu", {}, "99").messages[0].text.startsWith("Sorry"), "out-of-range number rejected")
  ok(stepFlow("faqs", {}, "what is the price?").node === "faqs", "off-topic question rejected")
  ok(stepFlow("svc_tmj", {}, "hi").node === "root", "hi → reset")
  ok(stepFlow("doctor_menu", {}, "x").messages[0].ui?.kind === "cta", "doctor reprompt keeps link button")
  ok(stepFlow("doctor_menu", {}, "menu").node === "patient_menu", "menu from doctor")
  ok(toPlainText(render("patient_menu", {}).messages[0]).includes("1. 📅 Book appointment"), "plain-text fallback")
  console.log("chat-flow OK")
}
