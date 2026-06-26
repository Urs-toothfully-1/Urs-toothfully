export const APP_NAME = "Ur's Toothfully"
export const APP_TAGLINE = "Full Mouth Rehabilitation & Implant Centre"
export const EMERGENCY_CONTACT = "7890008331"

export const CLINIC_HOURS = {
  weekday: "Mon–Sat: 10:30 AM – 8:30 PM",
  sunday: "Sun: 10:00 AM – 2:30 PM",
  closed: "Thursday: Day Off",
} as const

export const BRAND_COLORS = {
  primaryTeal: "#4ABCC8",
  secondaryGreen: "#7DC242",
  lightBackground: "#EBECEE",
  borderDivider: "#999999",
  panelGray: "#CCCCCC",
  white: "#FFFFFF",
  bodyText: "#333333",
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
