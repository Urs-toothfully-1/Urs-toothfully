/**
 * Rule-based questionnaire chatbot for Ur's Toothfully (no AI). A menu/decision
 * tree encoded from the clinic's script: Patient/Doctor → services → per-service
 * info → book → hand to reception; plus tips, contact, FAQs.
 *
 * Pure logic (no I/O) so it's unit-testable. State (current node + collected
 * answers) is persisted per phone by chatbot.service via WhatsAppChatState.
 *
 * ponytail: per-service long Q&A from the doc is condensed to an info blurb +
 * a "book a consultation" CTA — a rule-based bot can't do open Q&A; routing is
 * what matters. Upgrade path: swap a service node's text for an AI answerer.
 */

const PHONE1 = "7890008331"
const PHONE2 = "9748038280"

export interface FlowData {
  [k: string]: string
}

interface Option {
  keys: string[] // lowercased inputs that select this option
  next: string
  set?: FlowData // fields to record when chosen (e.g. which service)
}
interface FlowNode {
  message: string | ((d: FlowData) => string)
  options?: Option[]
  collect?: { field: string; next: string } // capture free text into data[field]
  handoff?: boolean // flag the chat for reception
}

export interface FlowStep {
  messages: string[]
  node: string
  data: FlowData
  handoff: boolean
}

const BACK = "\n\nReply 0 for the main menu."
const BOOK_CTA = "\n\nReply 1 to book a consultation, or 0 for the menu."

function service(title: string, blurb: string): FlowNode {
  return {
    message: `*${title}*\n\n${blurb}${BOOK_CTA}`,
    options: [
      { keys: ["1", "yes", "book", "consultation"], next: "book_time", set: { service: title } },
      { keys: ["0", "menu", "back"], next: "patient_menu" },
    ],
  }
}

export const FLOW: Record<string, FlowNode> = {
  root: {
    message:
      "Hello! 👋 Welcome to *Ur's Toothfully* — Full Mouth Rehabilitation & Implant Centre.\n" +
      "We're dedicated to a brighter, healthier smile for you! 😊\n\n" +
      "How can I help? Reply:\n1️⃣ I'm a Patient\n2️⃣ I'm a Doctor",
    options: [
      { keys: ["1", "patient", "patients"], next: "patient_menu" },
      { keys: ["2", "doctor", "doctors"], next: "doctor_menu" },
    ],
  },

  patient_menu: {
    message:
      "How can we help you today?\n\n" +
      "1️⃣ Our dental services\n2️⃣ Book an appointment\n3️⃣ Dental tips\n4️⃣ Contact & locations\n5️⃣ FAQs\n\n" +
      "_(Reply 0 anytime to return here.)_",
    options: [
      { keys: ["1", "services", "service"], next: "services_menu" },
      { keys: ["2", "book", "appointment"], next: "book_time", set: { service: "General appointment" } },
      { keys: ["3", "tips"], next: "tips" },
      { keys: ["4", "contact", "location", "locations"], next: "contact" },
      { keys: ["5", "faq", "faqs"], next: "faqs" },
    ],
  },

  services_menu: {
    message:
      "Our services — reply a number to learn more:\n\n" +
      "1  One-Visit Crown (CEREC)\n2  Dental Implants\n3  Fixed Teeth in a Day (All-on-4/6)\n" +
      "4  Root Canal (under microscope)\n5  Full Mouth Rehabilitation\n6  Braces & Invisalign\n" +
      "7  Smile Designing\n8  Dental Fillings\n9  Cleaning & Teeth Whitening\n10  TMJ Disorder\n\n0  Main menu",
    options: [
      { keys: ["1"], next: "svc_crown" },
      { keys: ["2"], next: "svc_implants" },
      { keys: ["3"], next: "svc_allon4" },
      { keys: ["4"], next: "svc_rct" },
      { keys: ["5"], next: "svc_fmr" },
      { keys: ["6"], next: "svc_braces" },
      { keys: ["7"], next: "svc_smile" },
      { keys: ["8"], next: "svc_fillings" },
      { keys: ["9"], next: "svc_cleaning" },
      { keys: ["10"], next: "svc_tmj" },
      { keys: ["0", "menu", "back"], next: "patient_menu" },
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

  // ── Booking flow ──────────────────────────────────────────────
  book_time: {
    message: "Great! 📅 What day & time would suit you? (e.g. 'Saturday 5 PM')",
    collect: { field: "preferred", next: "book_name" },
  },
  book_name: {
    message: "And your full name, please?",
    collect: { field: "name", next: "book_confirm" },
  },
  book_confirm: {
    message: (d) =>
      `Thank you${d.name ? `, ${d.name}` : ""}! 🙏 Our reception team will contact you shortly to confirm your ` +
      `${d.service && d.service !== "General appointment" ? `${d.service} ` : ""}appointment` +
      `${d.preferred ? ` (preferred: ${d.preferred})` : ""}.\n\nFor anything urgent, call ${PHONE1}.`,
    handoff: true,
    options: [{ keys: ["0", "menu", "back", "hi", "hello"], next: "patient_menu" }],
  },

  // ── Static info ───────────────────────────────────────────────
  tips: {
    message:
      "🦷 *Tips for a healthy smile:*\n" +
      "• Brush twice a day with fluoride toothpaste\n• Floss daily\n• Visit us every 6 months for a check-up\n" +
      "• Limit sugary snacks" +
      BACK,
    options: [{ keys: ["0", "menu", "back"], next: "patient_menu" }],
  },
  contact: {
    message:
      `📞 *Contact us:* +91 ${PHONE1} / ${PHONE2}\n\n` +
      "📍 *Locations:* New Alipore · Park Street · Salt Lake\n" +
      "🕙 *Hours:* Mon–Sat 10 AM–7:30 PM (Thu closed) · Sun 10 AM–2:30 PM" +
      BACK,
    options: [{ keys: ["0", "menu", "back"], next: "patient_menu" }],
  },
  faqs: {
    message:
      "❓ *FAQs* — reply a number:\n1  Clinic hours\n2  Emergency services\n3  Payment options\n\n0  Main menu",
    options: [
      { keys: ["1", "hours"], next: "faq_hours" },
      { keys: ["2", "emergency"], next: "faq_emergency" },
      { keys: ["3", "payment", "payments"], next: "faq_payment" },
      { keys: ["0", "menu", "back"], next: "patient_menu" },
    ],
  },
  faq_hours: {
    message: "🕙 Mon–Sat 10 AM–7:30 PM (closed Thursday) · Sun 10 AM–2:30 PM." + BACK,
    options: [{ keys: ["0", "menu", "back"], next: "patient_menu" }],
  },
  faq_emergency: {
    message: `🚑 Yes — for dental emergencies call us at +91 ${PHONE1}.` + BACK,
    options: [{ keys: ["0", "menu", "back"], next: "patient_menu" }],
  },
  faq_payment: {
    message: "💳 We accept cash, credit/debit cards, and online payments." + BACK,
    options: [{ keys: ["0", "menu", "back"], next: "patient_menu" }],
  },

  // ── Doctors ───────────────────────────────────────────────────
  doctor_menu: {
    message:
      "🧑‍⚕️ *Ur's Toothfully Digital Dental Lab* (New Alipore, Kolkata) — a full-service lab run by dentists, " +
      "prosthodontists and certified technicians, serving doctors across Kolkata since 2018.\n\n" +
      "🌐 https://digitaldentalab.in/\n\n" +
      `For lab enquiries call +91 ${PHONE1}.\n\nReply 0 for the main menu.`,
    options: [{ keys: ["0", "menu", "back", "hi", "hello"], next: "root" }],
  },
}

const RESET_WORDS = ["hi", "hello", "hey", "start", "restart"]

function render(nodeId: string, data: FlowData): FlowStep {
  const node = FLOW[nodeId] ?? FLOW.root
  const msg = typeof node.message === "function" ? node.message(data) : node.message
  return { messages: [msg], node: nodeId, data, handoff: Boolean(node.handoff) }
}

/** Advances the flow one step given the patient's input. Pure. */
export function stepFlow(currentNode: string, data: FlowData, rawInput: string): FlowStep {
  const input = rawInput.trim()
  const low = input.toLowerCase()

  if (RESET_WORDS.includes(low)) return render("root", {})
  if (low === "menu" || low === "main menu" || low === "0") {
    // "0"/menu is a valid option inside many nodes; only treat as global when the
    // current node doesn't itself define 0. Fall through to option handling first.
    const n = FLOW[currentNode]
    if (!n?.options?.some((o) => o.keys.includes("0"))) return render("patient_menu", data)
  }

  const node = FLOW[currentNode] ?? FLOW.root

  if (node.collect) {
    const nd = { ...data, [node.collect.field]: input }
    return render(node.collect.next, nd)
  }

  if (node.options) {
    const opt = node.options.find((o) => o.keys.includes(low))
    if (opt) return render(opt.next, opt.set ? { ...data, ...opt.set } : data)
    const r = render(currentNode, data)
    r.messages = [`Sorry, I didn't catch that. Please reply with one of the options.\n\n${r.messages[0]}`]
    return r
  }

  // Node with no options/collect → back to menu.
  return render("patient_menu", data)
}

/** Entry message for a brand-new / reset conversation. */
export function startFlow(): FlowStep {
  return render("root", {})
}

// demo(): runnable self-check for a full booking path.
if (typeof module !== "undefined" && require.main === module) {
  let s = startFlow()
  console.assert(s.node === "root" && s.messages[0].includes("Patient"), "start → root")
  s = stepFlow(s.node, s.data, "1")
  console.assert(s.node === "patient_menu", "1 → patient_menu")
  s = stepFlow(s.node, s.data, "1")
  console.assert(s.node === "services_menu", "1 → services_menu")
  s = stepFlow(s.node, s.data, "6")
  console.assert(s.node === "svc_braces" && s.messages[0].includes("Braces"), "6 → braces")
  s = stepFlow(s.node, s.data, "1")
  console.assert(s.node === "book_time", "1 → book_time")
  s = stepFlow(s.node, s.data, "Sat 5 PM")
  console.assert(s.node === "book_name" && s.data.preferred === "Sat 5 PM", "captured preferred")
  s = stepFlow(s.node, s.data, "Ramesh Kumar")
  console.assert(s.node === "book_confirm" && s.data.name === "Ramesh Kumar" && s.handoff, "captured name + handoff")
  console.assert(s.messages[0].includes("Ramesh Kumar") && s.messages[0].includes("Braces"), "confirm personalized")
  // invalid option re-prompts
  const bad = stepFlow("services_menu", {}, "99")
  console.assert(bad.node === "services_menu" && bad.messages[0].includes("Sorry"), "invalid → reprompt")
  // global reset
  const r = stepFlow("svc_tmj", { service: "x" }, "hi")
  console.assert(r.node === "root", "hi → reset root")
  console.log("chat-flow OK")
}
