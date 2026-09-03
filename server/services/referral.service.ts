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

  /** Find the referring patient by their code (case-insensitive). Returns null if unknown. */
  async findReferrerByCode(rawCode: string) {
    const code = normalizeReferralCode(rawCode)
    if (!code) return null
    return prisma.patient.findFirst({
      where: { referralCode: code, isDeleted: false },
      select: { id: true, fullName: true, patientId: true },
    })
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
        rewardType: true, rewardAmount: true, rewardNote: true, grantedAt: true,
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
    if (referral.status !== "QUALIFIED") throw new Error("Only a qualified referral can be rewarded.")

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
        rewardAmount: new Prisma.Decimal(input.amount),
        rewardNote: input.note || null,
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
}
