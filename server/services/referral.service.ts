import { prisma } from "@/lib/prisma"
import { generateReferralCode, normalizeReferralCode } from "@/lib/referral-code"
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

}
