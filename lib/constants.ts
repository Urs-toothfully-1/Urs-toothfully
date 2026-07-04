export const APP_NAME = "Ur's Toothfully"
export const APP_TAGLINE = "Full Mouth Rehabilitation & Implant Centre"
export const EMERGENCY_CONTACT = "7890008331"

export const CLINIC_HOURS = {
  weekday: "Mon–Sat: 10:30 AM – 8:30 PM",
  sunday: "Sun: 10:00 AM – 2:30 PM",
  closed: "Thursday: Day Off",
} as const

// Stitch design system palette (see stitch_screens/) — key names kept for
// compatibility: "primaryTeal" now carries the Stitch primary blue.
export const BRAND_COLORS = {
  // Primary brand
  primaryTeal: "#005E97",
  primaryTealHover: "#004A79",
  primaryTealLight: "#CFE5FF",
  secondaryGreen: "#006B5F",

  // App surfaces
  appBackground: "#F7F9FB",
  lightBackground: "#F2F4F6",
  cardBackground: "#FFFFFF",

  // Sidebar (light, Stitch style)
  sidebarBg: "#FFFFFF",
  sidebarText: "#404751",
  sidebarMuted: "#707882",
  sidebarActiveBg: "rgba(0,94,151,0.10)",
  sidebarActiveBorder: "#005E97",

  // Text
  bodyText: "#191C1E",
  secondaryText: "#404751",
  borderDivider: "#707882",

  // Borders
  borderLight: "#E0E3E5",
  borderMedium: "#C0C7D2",

  // Legacy aliases (keep for compatibility)
  panelGray: "#ECEEF0",
  white: "#FFFFFF",
} as const

export const SESSION_DURATION_HOURS = 8
export const BCRYPT_COST_FACTOR = 12
export const DEFAULT_ADVANCE_PERCENT = 20
export const DEFAULT_CONSULTATION_FEE = 1000

export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_LOCKOUT_MINUTES = 15

export const ID_PREFIXES = {
  patient: "PAT",
  visit: "VISIT",
  estimate: "EST",
  receipt: "RCP",
  exportBatch: "EXP",
} as const

export const TREATMENT_CATEGORIES = [
  "ENDODONTICS",
  "PROSTHODONTICS",
  "ORAL SURGERY",
  "PERIODONTICS",
  "ORTHODONTICS",
  "PEDODONTICS",
  "COSMETIC DENTISTRY",
  "ORAL MEDICINE & RADIOLOGY",
  "IMPLANTOLOGY",
  "PREVENTIVE DENTISTRY",
] as const

export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number]

export const ROUTES = {
  login: "/login",
  reception: "/reception",
  doctor: "/doctor",
  admin: "/admin",
  patients: "/patients",
  print: "/print",
} as const
