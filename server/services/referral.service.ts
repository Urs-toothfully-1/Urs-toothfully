import { prisma } from "@/lib/prisma"
import { Prisma, ReferralRewardType } from "@prisma/client"
import { generateReferralCode, normalizeReferralCode } from "@/lib/referral-code"
import { ledgerRepository } from "@/server/repositories/ledger.repository"
import { createAuditLog } from "@/lib/audit"

export const referralService = {
  /** Lazily assign a unique referral code to a patient (idempotent). */
  async ensureCode(patientId: string): Promise<string> {
    const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { referralCode: true } })
    if (existing?.referralCode) return existing.referralCode
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode()
      try {
        await prisma.patient.update({ where: { id: patientId }, data: { referralCode: code } })
        return code
      } catch {
        // Unique collision — try another code.
      }
    }
    throw new Error("Could not generate a unique referral code.")
  },

  /**
   * Who referred? Accepts a referral code OR the referrer's mobile number. Family
   * members share mobiles, so a mobile can match several patients — staff pick.
   */
  async findReferrerCandidates(raw: string) {
    const select = { id: true, fullName: true, patientId: true, mobile: true } as const
    const digits = raw.replace(/\D/g, "")
    if (digits.length >= 10) {
      return prisma.patient.findMany({
        where: { mobile: { contains: digits.slice(-10) }, isDeleted: false },
        select,
        orderBy: { createdAt: "asc" },
        take: 10,
      })
    }
    const code = normalizeReferralCode(raw)
    if (!code) return []
    const p = await prisma.patient.findFirst({ where: { referralCode: code, isDeleted: false }, select })
    return p ? [p] : []
  },

  /** The single referrer for a code or mobile — null if unknown or ambiguous. */
  async findReferrerByCode(raw: string) {
    const list = await referralService.findReferrerCandidates(raw)
    return list.length === 1 ? list[0] : null
  },

  /**
   * Link a new patient (referee) to a referrer. No-op if the referee is already
   * referred, or if referrer === referee. Referrer must be a real patient id.
   */
  async createReferral(input: { referrerId: string; refereeId: string; branchId: string; createdById: string }) {
    if (input.referrerId === input.refereeId) return null
    const already = await prisma.referral.findUnique({ where: { refereeId: input.refereeId }, select: { id: true } })
    if (already) return null
    const referral = await prisma.referral.create({
      data: {
        referrerId: input.referrerId,
        refereeId: input.refereeId,
        branchId: input.branchId,
        createdById: input.createdById,
      },
    })
    await createAuditLog({
      entityType: "Referral", entityId: referral.id, action: "CREATE",
      changedById: input.createdById, branchId: input.branchId,
    })
    return referral
  },

  /**
   * Qualify a referral when its referee makes their first payment. Called from
   * the payment flow. Safe to call on every payment — only flips PENDING once.
   */
  async qualifyForPayment(payment: { id: string; patientId: string }): Promise<void> {
    const referral = await prisma.referral.findUnique({
      where: { refereeId: payment.patientId },
      select: { id: true, status: true },
    })
    if (!referral || referral.status !== "PENDING") return
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: "QUALIFIED", qualifyingPaymentId: payment.id, qualifiedAt: new Date() },
    })
  },

  /** Total un-redeemed discount-credit reward a patient can spend on their next estimate. */
  async availableCreditForPatient(patientId: string): Promise<number> {
    const rows = await prisma.referral.findMany({
      where: { referrerId: patientId, status: "REWARDED", rewardType: "DISCOUNT_CREDIT", redeemedAt: null },
      select: { rewardAmount: true },
    })
    return Math.round(rows.reduce((s, r) => s + Number(r.rewardAmount ?? 0), 0) * 100) / 100
  },

  /**
   * Which whole credits fit within `cap`, greedily smallest-first (maximises how
   * many are used on a small estimate). Credits are redeemed whole — never split
   * — so a rupee applied always maps to a fully-redeemed credit (no reuse bug).
   * Leftover credits that don't fit stay available.
   */
  async planCreditRedemption(referrerId: string, cap: number): Promise<{ applied: number; ids: string[] }> {
    if (cap <= 0) return { applied: 0, ids: [] }
    const credits = await prisma.referral.findMany({
      where: { referrerId, status: "REWARDED", rewardType: "DISCOUNT_CREDIT", redeemedAt: null },
      orderBy: { rewardAmount: "asc" },
      select: { id: true, rewardAmount: true },
    })
    let applied = 0
    const ids: string[] = []
    for (const c of credits) {
      const amt = Number(c.rewardAmount ?? 0)
      if (amt > 0 && applied + amt <= cap + 0.001) {
        applied = Math.round((applied + amt) * 100) / 100
        ids.push(c.id)
      }
    }
    return { applied, ids }
  },

  async markRedeemed(ids: string[], estimateId: string): Promise<void> {
    if (ids.length === 0) return
    await prisma.referral.updateMany({
      where: { id: { in: ids } },
      data: { redeemedEstimateId: estimateId, redeemedAt: new Date() },
    })
  },

  async list(filters: { status?: "PENDING" | "QUALIFIED" | "REWARDED" | "CANCELLED"; branchId?: string }) {
    return prisma.referral.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
      select: {
        id: true, status: true, createdAt: true, qualifiedAt: true,
        rewardType: true, rewardAmount: true, rewardNote: true, grantedAt: true, redeemedAt: true,
        referrer: { select: { id: true, fullName: true, patientId: true } },
        referee: { select: { id: true, fullName: true, patientId: true } },
        branch: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    })
  },

  /** Grant a reward on a QUALIFIED referral. Monetary rewards post to the Cash Book. */
  async grantReward(input: {
    referralId: string
    type: ReferralRewardType
    amount: number
    note?: string
    grantedById: string
  }) {
    const referral = await prisma.referral.findUnique({
      where: { id: input.referralId },
      include: { referrer: { select: { fullName: true } }, referee: { select: { fullName: true } } },
    })
    if (!referral) throw new Error("Referral not found.")
    if (referral.status === "REWARDED") throw new Error("This referral has already been rewarded.")
    if (referral.status === "CANCELLED") throw new Error("This referral was cancelled.")
    // The doctor decides the reward; it can be given as soon as the referral is recorded.
    if ((input.type === "DISCOUNT_CREDIT" || input.type === "MONETARY") && !(input.amount > 0)) {
      throw new Error("Enter the reward amount.")
    }
    if (input.type === "FREE_TREATMENT" && !input.note?.trim()) throw new Error("Name the free treatment.")

    let ledgerEntryId: string | undefined
    if (input.type === "MONETARY") {
      const entry = await ledgerRepository.create({
        branchId: referral.branchId,
        entryDate: new Date(),
        direction: "OUT",
        category: "MARKETING",
        amount: new Prisma.Decimal(input.amount),
        paymentMode: "CASH",
        payee: referral.referrer.fullName,
        notes: `Referral reward for referring ${referral.referee.fullName}`,
        createdById: input.grantedById,
      })
      ledgerEntryId = entry.id
    }

    await prisma.referral.update({
      where: { id: input.referralId },
      data: {
        status: "REWARDED",
        rewardType: input.type,
        rewardAmount: input.amount > 0 ? new Prisma.Decimal(input.amount) : null,
        rewardNote: input.note?.trim() || null,
        rewardLedgerEntryId: ledgerEntryId ?? null,
        grantedById: input.grantedById,
        grantedAt: new Date(),
      },
    })

    await createAuditLog({
      entityType: "Referral", entityId: input.referralId, action: "UPDATE",
      changedById: input.grantedById, branchId: referral.branchId,
      newValues: { rewardType: input.type, rewardAmount: input.amount },
    })
  },

  /** Rewards this patient earned as a referrer that are granted but not yet used. */
  async availableRewards(patientId: string) {
    const rows = await prisma.referral.findMany({
      where: {
        referrerId: patientId,
        status: "REWARDED",
        redeemedAt: null,
        rewardType: { in: ["DISCOUNT_CREDIT", "FREE_CHECKUP", "FREE_TREATMENT"] },
      },
      orderBy: { grantedAt: "asc" },
      select: { id: true, rewardType: true, rewardAmount: true, rewardNote: true, referee: { select: { fullName: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      type: r.rewardType!,
      amount: r.rewardAmount != null ? Number(r.rewardAmount) : null,
      label: `${rewardLabel(r.rewardType, r.rewardAmount, r.rewardNote)} (for referring ${r.referee.fullName})`,
    }))
  },

  /** Mark a granted reward as used, e.g. the free check-up happened. */
  async markRewardUsed(referralId: string, note: string, userId: string) {
    const res = await prisma.referral.updateMany({
      where: { id: referralId, status: "REWARDED", redeemedAt: null },
      data: { redeemedAt: new Date(), redeemedNote: note.trim().slice(0, 300) || "Used" },
    })
    if (res.count === 0) throw new Error("This reward is not available to mark as used.")
    await createAuditLog({
      entityType: "Referral", entityId: referralId, action: "UPDATE",
      changedById: userId, newValues: { redeemed: true, note },
    })
  },

  /** Record who referred a patient after registration (missed at sign-up). */
  async linkReferrer(input: { refereeId: string; referrerId: string; userId: string }) {
    if (input.refereeId === input.referrerId) throw new Error("A patient can't refer themselves.")
    const [referee, referrer] = await Promise.all([
      prisma.patient.findUnique({ where: { id: input.refereeId }, select: { registrationBranchId: true, leadSource: true } }),
      prisma.patient.findUnique({ where: { id: input.referrerId }, select: { id: true } }),
    ])
    if (!referee || !referrer) throw new Error("Patient not found.")
    const created = await referralService.createReferral({
      referrerId: input.referrerId,
      refereeId: input.refereeId,
      branchId: referee.registrationBranchId,
      createdById: input.userId,
    })
    if (!created) throw new Error("This patient already has a referrer recorded.")
    // Already paid before being linked → qualifies now.
    const firstPayment = await prisma.payment.findFirst({
      where: { patientId: input.refereeId, isDeleted: false },
      orderBy: { paymentDate: "asc" },
      select: { id: true },
    })
    if (firstPayment) await referralService.qualifyForPayment({ id: firstPayment.id, patientId: input.refereeId })
    if (!referee.leadSource) {
      await prisma.patient.update({ where: { id: input.refereeId }, data: { leadSource: "Referral" } })
    }
    return created
  },

  /** Everything the patient's Referrals tab shows. */
  async overviewForPatient(patientId: string) {
    const code = await referralService.ensureCode(patientId)
    const [patient, referredBy, made] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId }, select: { mobile: true } }),
      prisma.referral.findUnique({
        where: { refereeId: patientId },
        select: { id: true, createdAt: true, status: true, referrer: { select: { id: true, fullName: true, patientId: true, mobile: true } } },
      }),
      prisma.referral.findMany({
        where: { referrerId: patientId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, status: true, createdAt: true, qualifiedAt: true,
          rewardType: true, rewardAmount: true, rewardNote: true, grantedAt: true,
          redeemedAt: true, redeemedNote: true,
          grantedBy: { select: { name: true } },
          referee: { select: { id: true, fullName: true, patientId: true } },
        },
      }),
    ])
    return { code, mobile: patient?.mobile ?? "", referredBy, made }
  },

  /** "Referred by" line for consultation / treatment screens. */
  async referredBy(patientId: string) {
    return prisma.referral.findUnique({
      where: { refereeId: patientId },
      select: { createdAt: true, referrer: { select: { id: true, fullName: true, patientId: true } } },
    })
  },
}

/** "₹500 discount", "Free check-up", "Free treatment: Scaling". */
export function rewardLabel(type: string | null, amount: unknown, note: string | null): string {
  const amt = amount != null ? Number(amount) : 0
  if (type === "DISCOUNT_CREDIT") return `₹${amt.toLocaleString("en-IN")} discount`
  if (type === "FREE_CHECKUP") return "Free check-up"
  if (type === "FREE_TREATMENT") return `Free treatment${note ? `: ${note}` : ""}`
  if (type === "MONETARY") return `₹${amt.toLocaleString("en-IN")} cash`
  return "—"
}
