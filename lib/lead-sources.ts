import { BRAND_COLORS } from "@/lib/constants"

/**
 * "Where did you find us?" — one list, used by patient registration, the public
 * intake form and the lead-source report.
 *
 * It lived in three places and had already drifted ("Online" vs "Online Search"),
 * which silently splits one real source across two rows in the report.
 */
export const LEAD_SOURCES = [
  "Walk-in",
  "Referral",
  "Website",
  "Online",
  "Social Media",
  "Google",
  "Friend / Family",
  "Other",
] as const

export type LeadSource = (typeof LEAD_SOURCES)[number]

export const LEAD_SOURCE_COLORS: Record<string, string> = {
  "Walk-in": BRAND_COLORS.primaryTeal,
  "Referral": BRAND_COLORS.secondaryGreen,
  "Website": "#0EA5E9",
  "Online": "#6D28D9",
  "Social Media": "#EC4899",
  "Google": "#1D4ED8",
  "Friend / Family": "#F59E0B",
  "Other": "#64748B",
}
