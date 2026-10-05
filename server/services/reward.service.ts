import { Prisma, type RewardKind } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { istTodayStr } from "@/lib/ist"
import { campaignRanOn, campaignStatus, isDiscountKind, rewardText } from "@/lib/rewards"

/**
 * Referral points + reward campaigns.
 *
 * Every referral is worth 1 point to the patient who referred and 1 point to
 * the patient who was referred, once the referred patient has paid for a first
 * visit (status QUALIFIED). The doctor spends any number of a patient's points
 * on a reward they decide; the exact referral "sides" spent are stamped with
 * the redemption id, so a point can never be used twice.
 */

type Db = Prisma.TransactionClient | typeof prisma
const EARNED = ["QUALIFIED", "REWARDED"] as const

export const KIND_VALUES = ["DISCOUNT_FLAT", "DISCOUNT_PERCENT", "FREE_CHECKUP", "FREE_TREATMENT", "OTHER"] as const

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2, "Give the campaign a name").max(120),
    tagline: z.string().trim().max(200).optional().or(z.literal("")),
    referrerOffer: z.string().trim().min(2, "Describe what the referrer gets").max(300),
    refereeOffer: z.string().trim().min(2, "Describe what the new patient gets").max(300),
    referrerKind: z.enum(KIND_VALUES),
    referrerValue: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
    refereeKind: z.enum(KIND_VALUES),
    refereeValue: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
    terms: z.string().trim().max(1000).optional().or(z.literal("")),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
    theme: z.string().max(20).default("teal"),
  })
  .refine((c) => !c.endsAt || c.endsAt >= c.startsAt, { message: "End date must be after the start date", path: ["endsAt"] })
  .refine((c) => c.referrerKind !== "DISCOUNT_PERCENT" || (c.referrerValue ?? 0) <= 100, { message: "A % discount can't exceed 100", path: ["referrerValue"] })
  .refine((c) => c.refereeKind !== "DISCOUNT_PERCENT" || (c.refereeValue ?? 0) <= 100, { message: "A % discount can't exceed 100", path: ["refereeValue"] })
export type CampaignInput = z.infer<typeof campaignSchema>

export const redeemSchema = z
  .object({
    patientId: z.string().min(1),
    points: z.number().int().min(1, "Use at least 1 point").max(500),
    campaignId: z.string().min(1).optional().nullable(),
    kind: z.enum(KIND_VALUES),
    value: z.number().min(0).max(10_000_000).optional().nullable(),
    description: z.string().trim().max(300).optional().default(""),
    note: z.string().trim().max(300).optional(),
    /** Free check-up / treatment given today → mark used straight away. */
    markUsedNow: z.boolean().default(false),
  })
  .refine((r) => !isDiscountKind(r.kind) || (r.value ?? 0) > 0, { message: "Enter the discount amount", path: ["value"] })
  .refine((r) => r.kind !== "DISCOUNT_PERCENT" || (r.value ?? 0) <= 100, { message: "A % discount can't exceed 100", path: ["value"] })
  .refine((r) => !(r.kind === "FREE_TREATMENT" || r.kind === "OTHER") || r.description.length > 0, {
    message: "Describe the reward (e.g. the treatment)",
    path: ["description"],
  })
export type RedeemInput = z.input<typeof redeemSchema>

const dateOnly = (d: string) => new Date(`${d}T00:00:00Z`)

export type PointUnit = {
  referralId: string
  side: "REFERRER" | "REFEREE"
  date: Date
  /** The other patient on this referral. */
  other: { id: string; fullName: string; patientId: string }
  state: "AVAILABLE" | "PENDING" | "USED"
}

async function pointUnits(patientId: string, db: Db): Promise<PointUnit[]> {
  const [made, received] = await Promise.all([
    db.referral.findMany({
      where: { referrerId: patientId, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, createdAt: true, referrerRedemptionId: true, referee: { select: { id: true, fullName: true, patientId: true } } },
    }),
    db.referral.findUnique({
      where: { refereeId: patientId },
      select: { id: true, status: true, createdAt: true, refereeRedemptionId: true, referrer: { select: { id: true, fullName: true, patientId: true } } },
    }),
  ])
  const state = (status: string, spent: string | null): PointUnit["state"] =>
    spent ? "USED" : (EARNED as readonly string[]).includes(status) ? "AVAILABLE" : "PENDING"
  const units: PointUnit[] = made.map((r) => ({
    referralId: r.id, side: "REFERRER", date: r.createdAt, other: r.referee, state: state(r.status, r.referrerRedemptionId),
  }))
  if (received && received.status !== "CANCELLED") {
    units.push({ referralId: received.id, side: "REFEREE", date: received.createdAt, other: received.referrer, state: state(received.status, received.refereeRedemptionId) })
  }
  return units.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export const rewardService = {
  // ─── Campaigns ──────────────────────────────────────────────

  async listCampaigns() {
    return prisma.rewardCampaign.findMany({
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
      include: { _count: { select: { redemptions: true } }, createdBy: { select: { name: true } } },
    })
  },

  /** Campaigns running today (active, within dates). */
  async liveCampaigns() {
    const today = istTodayStr()
    const all = await prisma.rewardCampaign.findMany({ where: { isActive: true }, orderBy: { startsAt: "desc" } })
    return all.filter((c) => campaignStatus(c, today) === "LIVE")
  },

  async createCampaign(raw: unknown, userId: string) {
    const c = campaignSchema.parse(raw)
    const created = await prisma.rewardCampaign.create({ data: { ...toCampaignData(c), createdById: userId } })
    await createAuditLog({ entityType: "RewardCampaign", entityId: created.id, action: "CREATE", changedById: userId, newValues: { name: c.name } })
    return created
  },

  async updateCampaign(id: string, raw: unknown, userId: string) {
    const c = campaignSchema.parse(raw)
    await prisma.rewardCampaign.update({ where: { id }, data: toCampaignData(c) })
    await createAuditLog({ entityType: "RewardCampaign", entityId: id, action: "UPDATE", changedById: userId, newValues: { name: c.name } })
  },

  async setCampaignActive(id: string, isActive: boolean, userId: string) {
    await prisma.rewardCampaign.update({ where: { id }, data: { isActive } })
    await createAuditLog({ entityType: "RewardCampaign", entityId: id, action: "STATUS_CHANGE", changedById: userId, newValues: { isActive } })
  },

  /** Delete only if never used; otherwise it stays as history (pause/end it instead). */
  async deleteCampaign(id: string, userId: string) {
    const used = await prisma.referralRedemption.count({ where: { campaignId: id } })
    if (used > 0) throw new Error("This campaign has rewards given under it — pause or end it instead of deleting.")
    await prisma.rewardCampaign.delete({ where: { id } })
    await createAuditLog({ entityType: "RewardCampaign", entityId: id, action: "DELETE", changedById: userId })
  },

  // ─── Points ─────────────────────────────────────────────────

  async points(patientId: string) {
    const units = await pointUnits(patientId, prisma)
    const count = (s: PointUnit["state"]) => units.filter((u) => u.state === s).length
    return { units, available: count("AVAILABLE"), pending: count("PENDING"), used: count("USED") }
  },

  /**
   * Spend `points` of a patient's available points on a reward. Oldest points
   * are used first. Each referral side is claimed with a conditional update, so
   * two doctors redeeming at once can never spend the same point.
   */
  async redeem(raw: RedeemInput, userId: string, branchId: string) {
    const input = redeemSchema.parse(raw)
    const redemption = await prisma.$transaction(async (tx) => {
      const available = (await pointUnits(input.patientId, tx)).filter((u) => u.state === "AVAILABLE")
      if (available.length < input.points) {
        throw new Error(`Only ${available.length} point${available.length === 1 ? "" : "s"} available.`)
      }
      if (input.campaignId) {
        const exists = await tx.rewardCampaign.findUnique({ where: { id: input.campaignId }, select: { id: true } })
        if (!exists) throw new Error("Campaign not found.")
      }
      const created = await tx.referralRedemption.create({
        data: {
          patientId: input.patientId,
          branchId,
          campaignId: input.campaignId || null,
          points: input.points,
          kind: input.kind as RewardKind,
          value: isDiscountKind(input.kind) ? new Prisma.Decimal(input.value ?? 0) : null,
          description: input.description || rewardText(input.kind, input.value),
          note: input.note || null,
          usedAt: input.markUsedNow ? new Date() : null,
          usedNote: input.markUsedNow ? "Given at the visit" : null,
          createdById: userId,
        },
      })
      for (const u of available.slice(0, input.points)) {
        const res = u.side === "REFERRER"
          ? await tx.referral.updateMany({ where: { id: u.referralId, referrerRedemptionId: null }, data: { referrerRedemptionId: created.id } })
          : await tx.referral.updateMany({ where: { id: u.referralId, refereeRedemptionId: null }, data: { refereeRedemptionId: created.id } })
        if (res.count !== 1) throw new Error("Those points were just used by someone else — please refresh and try again.")
      }
      return created
    })
    await createAuditLog({
      entityType: "ReferralRedemption", entityId: redemption.id, action: "CREATE", changedById: userId, branchId,
      newValues: { patientId: input.patientId, points: input.points, reward: rewardText(input.kind, input.value, input.description) },
    })
    return redemption
  },

  /** Undo a reward given by mistake: points come back. Only while unused. */
  async cancelRedemption(id: string, userId: string) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.referralRedemption.findUnique({ where: { id }, select: { usedAt: true } })
      if (!r) throw new Error("Reward not found.")
      if (r.usedAt) throw new Error("This reward was already used — it can't be cancelled.")
      await tx.referral.updateMany({ where: { referrerRedemptionId: id }, data: { referrerRedemptionId: null } })
      await tx.referral.updateMany({ where: { refereeRedemptionId: id }, data: { refereeRedemptionId: null } })
      await tx.referralRedemption.delete({ where: { id } })
    })
    await createAuditLog({ entityType: "ReferralRedemption", entityId: id, action: "DELETE", changedById: userId })
  },

  async markUsed(id: string, note: string, userId: string) {
    const res = await prisma.referralRedemption.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date(), usedNote: note.trim().slice(0, 300) || "Used" },
    })
    if (res.count === 0) throw new Error("This reward is already used.")
    await createAuditLog({ entityType: "ReferralRedemption", entityId: id, action: "STATUS_CHANGE", changedById: userId, newValues: { used: true, note } })
  },

  /** Unused discount rewards — offered in the billing dialog. */
  async availableDiscounts(patientId: string) {
    const rows = await prisma.referralRedemption.findMany({
      where: { patientId, usedAt: null, kind: { in: ["DISCOUNT_FLAT", "DISCOUNT_PERCENT"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, value: true, description: true, points: true, campaign: { select: { name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as "DISCOUNT_FLAT" | "DISCOUNT_PERCENT",
      value: Number(r.value ?? 0),
      label: `${rewardText(r.kind, Number(r.value))} — ${r.points} referral point${r.points === 1 ? "" : "s"}${r.campaign ? ` (${r.campaign.name})` : ""}`,
    }))
  },

  /** Everything the consultation / treatment panel and the Referrals tab show. */
  async overview(patientId: string) {
    const [patient, referredBy, made, pts, redemptions, campaigns] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { referralCode: true, mobile: true } }),
      prisma.referral.findUnique({
        where: { refereeId: patientId },
        select: { id: true, createdAt: true, status: true, referrer: { select: { id: true, fullName: true, patientId: true } } },
      }),
      prisma.referral.findMany({
        where: { referrerId: patientId },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, status: true, referrerRedemptionId: true, referee: { select: { id: true, fullName: true, patientId: true } } },
      }),
      rewardService.points(patientId),
      prisma.referralRedemption.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: { campaign: { select: { name: true, theme: true } }, createdBy: { select: { name: true } } },
      }),
      prisma.rewardCampaign.findMany({ orderBy: { startsAt: "desc" } }),
    ])
    const today = istTodayStr()
    const live = campaigns.filter((c) => campaignStatus(c, today) === "LIVE")
    // Campaigns that were running when each referral happened.
    const ranAt = (d: Date) => campaigns.filter((c) => campaignRanOn(c, d.toISOString().slice(0, 10)))
    return {
      code: patient?.referralCode ?? null,
      mobile: patient?.mobile ?? "",
      referredBy: referredBy ? { ...referredBy, campaigns: ranAt(referredBy.createdAt) } : null,
      made: made.map((r) => ({ ...r, campaigns: ranAt(r.createdAt) })),
      points: pts,
      redemptions,
      live,
    }
  },
}

function toCampaignData(c: CampaignInput) {
  const money = (kind: string, v: number | null | undefined) => (isDiscountKind(kind) && v ? new Prisma.Decimal(v) : null)
  return {
    name: c.name,
    tagline: c.tagline || null,
    referrerOffer: c.referrerOffer,
    refereeOffer: c.refereeOffer,
    referrerKind: c.referrerKind as RewardKind,
    referrerValue: money(c.referrerKind, c.referrerValue),
    refereeKind: c.refereeKind as RewardKind,
    refereeValue: money(c.refereeKind, c.refereeValue),
    terms: c.terms || null,
    startsAt: dateOnly(c.startsAt),
    endsAt: c.endsAt ? dateOnly(c.endsAt) : null,
    isActive: c.isActive,
    theme: c.theme,
  }
}
