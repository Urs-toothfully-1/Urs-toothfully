/**
 * Reward wording + campaign status — shared by the admin Rewards page, the
 * public /rewards page, the doctor's redeem dialog and invoices.
 */

export type RewardKind = "DISCOUNT_FLAT" | "DISCOUNT_PERCENT" | "FREE_CHECKUP" | "FREE_TREATMENT" | "OTHER"

export const REWARD_KINDS: { value: RewardKind; label: string }[] = [
  { value: "DISCOUNT_FLAT", label: "₹ discount" },
  { value: "DISCOUNT_PERCENT", label: "% discount" },
  { value: "FREE_CHECKUP", label: "Free check-up" },
  { value: "FREE_TREATMENT", label: "Free treatment" },
  { value: "OTHER", label: "Other / custom" },
]

export const isDiscountKind = (k: string) => k === "DISCOUNT_FLAT" || k === "DISCOUNT_PERCENT"

/** "₹500 off", "10% off", "Free check-up", "Free treatment: Scaling", or the custom text. */
export function rewardText(kind: string, value: number | null | undefined, description?: string | null): string {
  const v = Number(value ?? 0)
  if (kind === "DISCOUNT_FLAT" && v > 0) return `₹${v.toLocaleString("en-IN")} off`
  if (kind === "DISCOUNT_PERCENT" && v > 0) return `${v}% off`
  if (kind === "FREE_CHECKUP") return "Free check-up"
  if (kind === "FREE_TREATMENT") return description ? `Free treatment: ${description}` : "Free treatment"
  return description || "Reward"
}

export type CampaignStatus = "LIVE" | "SCHEDULED" | "ENDED" | "PAUSED"

/** `day` is YYYY-MM-DD (IST). Dates compare as calendar days. */
export function campaignStatus(c: { isActive: boolean; startsAt: Date | string; endsAt: Date | string | null }, day: string): CampaignStatus {
  const start = new Date(c.startsAt).toISOString().slice(0, 10)
  const end = c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 10) : null
  if (end && day > end) return "ENDED"
  if (!c.isActive) return "PAUSED"
  if (day < start) return "SCHEDULED"
  return "LIVE"
}

/** Was the campaign running (ignoring pause) on that calendar day? */
export function campaignRanOn(c: { startsAt: Date | string; endsAt: Date | string | null }, day: string): boolean {
  const start = new Date(c.startsAt).toISOString().slice(0, 10)
  const end = c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 10) : null
  return day >= start && (!end || day <= end)
}

export const CAMPAIGN_THEMES: Record<string, { from: string; to: string; soft: string; ink: string }> = {
  teal: { from: "#005E97", to: "#006B5F", soft: "#E6F4F2", ink: "#00557F" },
  gold: { from: "#B7791F", to: "#7B4A12", soft: "#FDF4E3", ink: "#8A5A14" },
  rose: { from: "#BE185D", to: "#7E1D4F", soft: "#FDECF3", ink: "#9D174D" },
  violet: { from: "#6D28D9", to: "#3B1C8C", soft: "#F1ECFE", ink: "#5B21B6" },
  emerald: { from: "#047857", to: "#064E3B", soft: "#E7F7F0", ink: "#065F46" },
  midnight: { from: "#1F2937", to: "#0B1220", soft: "#EEF0F3", ink: "#111827" },
}
export const themeOf = (t: string) => CAMPAIGN_THEMES[t] ?? CAMPAIGN_THEMES.teal

/** "Priya S." — what a public page shows of a patient's name. */
export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0]
}

// demo(): runnable self-check (npx tsx lib/rewards.ts).
if (typeof module !== "undefined" && require.main === module) {
  const ok = (c: boolean, m: string) => { if (!c) throw new Error(`FAIL: ${m}`) }
  ok(rewardText("DISCOUNT_FLAT", 500) === "₹500 off", "flat")
  ok(rewardText("DISCOUNT_PERCENT", 10) === "10% off", "pct")
  ok(rewardText("FREE_TREATMENT", null, "Scaling") === "Free treatment: Scaling", "free tx")
  const c = { isActive: true, startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z" }
  ok(campaignStatus(c, "2026-10-05") === "LIVE", "live")
  ok(campaignStatus(c, "2026-09-30") === "SCHEDULED", "scheduled")
  ok(campaignStatus(c, "2026-11-01") === "ENDED", "ended")
  ok(campaignStatus({ ...c, isActive: false }, "2026-10-05") === "PAUSED", "paused")
  ok(campaignStatus({ ...c, endsAt: null }, "2027-05-05") === "LIVE", "open-ended")
  ok(campaignRanOn(c, "2026-10-31") && !campaignRanOn(c, "2026-11-01"), "ran on")
  ok(publicName("Priya Sharma Das") === "Priya D." && publicName("Ravi") === "Ravi", "public name")
  console.log("rewards OK")
}
