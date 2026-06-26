export const APP_NAME = "Ur's Toothfully"
export const APP_TAGLINE = "Full Mouth Rehabilitation & Implant Centre"
export const EMERGENCY_CONTACT = "7890008331"

export const CLINIC_HOURS = {
  weekday: "Mon–Sat: 10:30 AM – 8:30 PM",
  sunday: "Sun: 10:00 AM – 2:30 PM",
  closed: "Thursday: Day Off",
} as const

export const BRAND_COLORS = {
  // Primary brand
  primaryTeal: "#0891B2",
  primaryTealHover: "#0E7490",
  primaryTealLight: "#CFFAFE",
  secondaryGreen: "#059669",

  // App surfaces
  appBackground: "#F1F5F9",
  lightBackground: "#F8FAFC",
  cardBackground: "#FFFFFF",

  // Sidebar (dark)
  sidebarBg: "#0F172A",
  sidebarText: "#CBD5E1",
  sidebarMuted: "#64748B",
  sidebarActiveBg: "rgba(14,165,233,0.12)",
  sidebarActiveBorder: "#0EA5E9",

  // Text
  bodyText: "#0F172A",
  secondaryText: "#475569",
  borderDivider: "#64748B",

  // Borders
  borderLight: "#E2E8F0",
  borderMedium: "#CBD5E1",

  // Legacy aliases (keep for compatibility)
  panelGray: "#F1F5F9",
  white: "#FFFFFF",
} as const

export const SESSION_DURATION_HOURS = 8
export const BCRYPT_COST_FACTOR = 12
export const DEFAULT_ADVANCE_PERCENT = 20
export const DEFAULT_CONSULTATION_FEE = 500

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
