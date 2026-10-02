/**
 * Rule-based questionnaire chatbot for Ur's Toothfully (no AI). A menu/decision
 * tree encoded from the clinic's script: Patient/Doctor → services → per-service
 * info → book → hand to reception; plus tips, contact, FAQs.
 *
 * Each step can carry WhatsApp interactive UI — reply buttons (≤3), a list menu
 * (≤10 rows) or a link button — sent as free session messages. Typed numbers /
 * keywords still work, and every message has a plain-text fallback.
 *
 * Pure logic (no I/O) so it's unit-testable. State (current node + collected
 * answers) is persisted per phone by chatbot.service via WhatsAppChatState.
 *
 * ponytail: per-service long Q&A from the doc is condensed to an info blurb +
 * a "book a consultation" button — a rule-based bot can't do open Q&A.
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

/** One outgoing bot message: text plus optional interactive UI. */
export interface OutMsg {
  text: string
  ui?: NodeUI
}

interface Option {
  id: string // interactive reply id; also accepted as typed input
  title: string
  description?: string
  keys?: string[] // extra lowercased typed inputs that select this option
  next: string
  set?: FlowData // fields to record when chosen (e.g. which service)
  hidden?: boolean // selectable by typing, but not shown as a button/row
}
interface Suggestion {
  id: string
  title: string
  value: string // what gets stored when tapped
}
interface FlowNode {
  message: string | ((d: FlowData) => string)
  options?: Option[]
  ui?: "buttons" | "list" // how to render the visible options
  listButton?: string // label of the list-menu button
  cta?: { label: string; url: string } // single link button
  collect?: { field: string; next: string; suggest?: Suggestion[] } // free text (+ quick-pick buttons)
  handoff?: boolean // flag the chat for reception
}

export interface FlowStep {
  messages: OutMsg[]
  node: string
  data: FlowData
  handoff: boolean
}

const MENU: Option = { id: "menu", title: "🏠 Main menu", keys: ["0", "menu", "back"], next: "patient_menu" }

function service(_id: string, title: string, blurb: string): FlowNode {
  return {
    message: `*${title}*\n\n${blurb}`,
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book consultation", keys: ["yes", "consultation"], next: "book_time", set: { service: title } },
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
    options: [
      { id: "patient", title: "🧑 I'm a Patient", keys: ["patients"], next: "patient_menu" },
      { id: "doctor", title: "🩺 I'm a Doctor", keys: ["doctors"], next: "doctor_menu" },
    ],
  },

  patient_menu: {
    message: "What would you like to do? 👇",
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book appointment", keys: ["appointment"], next: "book_time", set: { service: "General appointment" } },
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
      MENU,
    ],
  },

  services_menu: {
    message: "Our specialised treatments 🦷\nTap *View services* to learn more about any of them.\n\n_Reply 0 for the main menu._",
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
      { ...MENU, hidden: true },
    ],
  },

  svc_crown: service(
    "svc_crown",
    "One-Visit Crown (CEREC)",
    "Get a custom crown designed, milled and fitted in a single visit using CEREC technology — a digital scan creates a 3D model, the crown is milled in-office and cemented the same day. As strong and natural-looking as traditional crowns."
  ),
  svc_implants: service(
    "svc_implants",
    "Dental Implants",
    "A permanent solution for missing teeth — a titanium post integrates with your jawbone and supports a crown that looks and works like a natural tooth."
  ),
  svc_allon4: service(
    "svc_allon4",
    "Fixed Teeth in a Day (All-on-4/6)",
    "A complete set of fixed teeth in a single day. We place 4–6 implants per arch and attach a temporary set the same day, so you leave with a new smile immediately. Permanent teeth follow once the implants integrate."
  ),
  svc_rct: service(
    "svc_rct",
    "Root Canal Under Microscope",
    "Root canal treatment performed with a high-powered microscope for greater precision — better visibility of complex canals, higher success rate, and a more comfortable experience."
  ),
  svc_fmr: service(
    "svc_fmr",
    "Full Mouth Rehabilitation",
    "A comprehensive plan to restore the function, health and appearance of your whole mouth — combining implants, crowns, bridges, veneers and, if needed, orthodontics, tailored to you."
  ),
  svc_braces: service(
    "svc_braces",
    "Braces & Invisalign",
    "Straighten your teeth with traditional braces (great for complex cases) or clear, removable Invisalign aligners (discreet, for mild–moderate cases). We'll help you choose in a consultation."
  ),
  svc_smile: service(
    "svc_smile",
    "Smile Designing",
    "A cosmetic plan to enhance the shape, colour and alignment of your smile — using veneers, whitening, crowns and more, with digital imaging to preview your new smile."
  ),
  svc_fillings: service(
    "svc_fillings",
    "Dental Fillings",
    "Restore teeth damaged by decay or cracks. We offer tooth-coloured composite, glass-ionomer and ceramic fillings. The procedure is quick and comfortable with local anaesthesia."
  ),
  svc_cleaning: service(
    "svc_cleaning",
    "Cleaning & Teeth Whitening",
    "Professional cleaning removes plaque, tartar and stains to prevent gum disease and cavities. Whitening is available as in-office (immediate results) or take-home kits (gradual)."
  ),
  svc_tmj: service(
    "svc_tmj",
    "TMJ Disorder",
    "Pain or clicking in the jaw joint, headaches or difficulty moving your jaw can signal TMJ disorder. Treatments include night guards/splints, physiotherapy, medication and bite adjustment."
  ),

  // ── Booking flow ──────────────────────────────────────────────
  book_time: {
    message: "Great! 📅 When would you like to visit?\n\nTap an option, or type your preferred day & time (e.g. 'Saturday 5 PM').",
    collect: {
      field: "preferred",
      next: "book_name",
      suggest: [
        { id: "t_today", title: "Today", value: "Today" },
        { id: "t_tomorrow", title: "Tomorrow", value: "Tomorrow" },
        { id: "t_weekend", title: "This weekend", value: "This weekend" },
      ],
    },
  },
  book_name: {
    message: "Perfect 👍 And your full name, please? ✍️",
    collect: { field: "name", next: "book_confirm" },
  },
  book_confirm: {
    message: (d) =>
      `Thank you${d.name ? `, ${d.name}` : ""}! 🙏 Our reception team will contact you shortly to confirm your ` +
      `${d.service && d.service !== "General appointment" ? `${d.service} ` : ""}appointment` +
      `${d.preferred ? ` (preferred: ${d.preferred})` : ""}.\n\nFor anything urgent, call ${PHONE1}.`,
    handoff: true,
    ui: "buttons",
    options: [{ ...MENU, keys: ["0", "menu", "back"] }],
  },

  // ── Static info ───────────────────────────────────────────────
  tips: {
    message:
      "🦷 *Tips for a healthy smile:*\n" +
      "• Brush twice a day with fluoride toothpaste\n• Floss daily\n• Visit us every 6 months for a check-up\n" +
      "• Limit sugary snacks",
    ui: "buttons",
    options: [
      { id: "book", title: "📅 Book check-up", keys: ["checkup"], next: "book_time", set: { service: "Check-up" } },
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
      { id: "book", title: "📅 Book appointment", next: "book_time", set: { service: "General appointment" } },
      MENU,
    ],
  },
  faqs: {
    message: "❓ *FAQs* — tap a question 👇\n\n_Reply 0 for the main menu._",
    ui: "buttons",
    options: [
      { id: "faq_hours", title: "🕙 Clinic hours", keys: ["hours"], next: "faq_hours" },
      { id: "faq_emergency", title: "🚑 Emergencies", keys: ["emergency"], next: "faq_emergency" },
      { id: "faq_payment", title: "💳 Payments", keys: ["payment"], next: "faq_payment" },
      { ...MENU, hidden: true },
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
      `For lab enquiries call +91 ${PHONE1}.\n\n_Reply 0 for the main menu._`,
    cta: { label: "Visit Lab Website", url: "https://digitaldentalab.in/" },
    options: [{ id: "menu", title: "Main menu", keys: ["0", "menu", "back"], next: "root", hidden: true }],
  },
}

const RESET_WORDS = ["hi", "hello", "hey", "start", "restart"]

function visibleOptions(node: FlowNode): Option[] {
  return (node.options ?? []).filter((o) => !o.hidden)
}

function render(nodeId: string, data: FlowData): FlowStep {
  const node = FLOW[nodeId] ?? FLOW.root
  const text = typeof node.message === "function" ? node.message(data) : node.message
  let ui: NodeUI | undefined
  if (node.cta) {
    ui = { kind: "cta", label: node.cta.label, url: node.cta.url }
  } else if (node.collect?.suggest?.length) {
    ui = { kind: "buttons", items: node.collect.suggest.map((s) => ({ id: s.id, title: s.title })) }
  } else if (node.ui) {
    const items = visibleOptions(node).map((o) => ({ id: o.id, title: o.title, description: o.description }))
    ui = node.ui === "list" ? { kind: "list", button: node.listButton ?? "Options", items } : { kind: "buttons", items }
  }
  return { messages: [{ text, ui }], node: nodeId, data, handoff: Boolean(node.handoff) }
}

function matchOption(node: FlowNode, low: string, replyId?: string): Option | undefined {
  const all = node.options ?? []
  const byId = all.find((o) => (replyId && o.id === replyId) || o.id === low || o.keys?.includes(low))
  if (byId) return byId
  if (/^\d+$/.test(low)) return visibleOptions(node)[Number(low) - 1] // typed number = position
  return undefined
}

/**
 * Advances the flow one step. `rawInput` is what the patient typed (or the
 * tapped button's title); `replyId` is the tapped button/list row id, if any.
 */
export function stepFlow(currentNode: string, data: FlowData, rawInput: string, replyId?: string): FlowStep {
  const input = rawInput.trim()
  const low = input.toLowerCase()
  const node = FLOW[currentNode] ?? FLOW.root

  if (!replyId && RESET_WORDS.includes(low)) return render("root", {})

  if (node.collect) {
    const s = node.collect.suggest
    const picked =
      (replyId && s?.find((x) => x.id === replyId)) || (/^\d+$/.test(low) && s ? s[Number(low) - 1] : undefined)
    const value = picked ? picked.value : input
    return render(node.collect.next, { ...data, [node.collect.field]: value })
  }

  const opt = node.options ? matchOption(node, low, replyId) : undefined
  if (opt) return render(opt.next, opt.set ? { ...data, ...opt.set } : data)

  // Global "menu"/"0" when this node doesn't handle it itself.
  if (["menu", "main menu", "0"].includes(low)) return render("patient_menu", data)

  if (node.options) {
    const r = render(currentNode, data)
    r.messages[0] = { ...r.messages[0], text: `Sorry, I didn't catch that — please tap an option below.\n\n${r.messages[0].text}` }
    return r
  }
  return render("patient_menu", data)
}

/** Entry message for a brand-new / reset conversation. */
export function startFlow(): FlowStep {
  return render("root", {})
}

/** Plain-text version of a message (fallback send + inbox log). */
export function toPlainText(m: OutMsg): string {
  if (!m.ui) return m.text
  if (m.ui.kind === "cta") return `${m.text}\n\n🔗 ${m.ui.url}`
  return `${m.text}\n\n${m.ui.items.map((it, i) => `${i + 1}. ${it.title}`).join("\n")}`
}

// demo(): runnable self-check — taps (reply ids) and typed numbers.
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  let s = startFlow()
  ok(s.node === "root" && s.messages[0].ui?.kind === "buttons", "start → root with buttons")
  s = stepFlow(s.node, s.data, "🧑 I'm a Patient", "patient")
  ok(s.node === "patient_menu" && s.messages[0].ui?.kind === "buttons", "tap patient → patient_menu buttons")
  s = stepFlow(s.node, s.data, "🦷 Our services", "services")
  ok(s.node === "services_menu" && s.messages[0].ui?.kind === "list", "tap services → list")
  const list = s.messages[0].ui
  ok(list?.kind === "list" && list.items.length === 10, "list has 10 rows (back hidden)")
  s = stepFlow(s.node, s.data, "Braces & Invisalign", "svc_braces")
  ok(s.node === "svc_braces", "tap braces row")
  s = stepFlow(s.node, s.data, "📅 Book consultation", "book")
  ok(s.node === "book_time" && s.data.service === "Braces & Invisalign", "tap book → book_time w/ service")
  ok(s.messages[0].ui?.kind === "buttons", "book_time shows quick-pick buttons")
  s = stepFlow(s.node, s.data, "Tomorrow", "t_tomorrow")
  ok(s.node === "book_name" && s.data.preferred === "Tomorrow", "tap Tomorrow stored")
  s = stepFlow(s.node, s.data, "Ramesh Kumar")
  ok(s.node === "book_confirm" && s.handoff && s.messages[0].text.includes("Ramesh Kumar"), "name → confirm + handoff")
  // typed fallbacks
  ok(stepFlow("root", {}, "1").node === "patient_menu", "typed 1 → patient")
  ok(stepFlow("services_menu", {}, "6").node === "svc_braces", "typed 6 → braces")
  ok(stepFlow("services_menu", {}, "0").node === "patient_menu", "typed 0 → menu")
  ok(stepFlow("book_time", {}, "Sat 5 PM").data.preferred === "Sat 5 PM", "typed free time")
  ok(stepFlow("services_menu", {}, "99").messages[0].text.startsWith("Sorry"), "invalid → reprompt")
  ok(stepFlow("svc_tmj", {}, "hi").node === "root", "hi → reset")
  ok(stepFlow("doctor_menu", {}, "x").messages[0].ui?.kind === "cta", "doctor reprompt keeps link button")
  ok(toPlainText(render("patient_menu", {}).messages[0]).includes("1. 📅 Book appointment"), "plain-text fallback")
  console.log("chat-flow OK")
}
