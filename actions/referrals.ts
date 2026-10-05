"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/auth"
import { referralService } from "@/server/services/referral.service"

const grantSchema = z.object({
  referralId: z.string().uuid(),
  type: z.enum(["DISCOUNT_CREDIT", "FREE_CHECKUP", "FREE_TREATMENT", "MONETARY"]),
  amount: z.coerce.number().min(0).finite().default(0),
  note: z.string().trim().max(300).optional(),
})

function revalidateReferral(patientIds: string[]) {
  revalidatePath("/admin/referrals")
  for (const id of patientIds) revalidatePath(`/patients/${id}`, "layout")
}

/** Find the referrer by code or mobile number (staff pick when a mobile is shared). */
export async function lookupReferrerAction(query: string) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized", candidates: [] }
  const q = query.trim().slice(0, 30)
  if (q.length < 4) return { candidates: [] }
  return { candidates: await referralService.findReferrerCandidates(q) }
}

/** Record who referred an already-registered patient. */
export async function linkReferrerAction(refereeId: string, referrerId: string) {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await referralService.linkReferrer({ refereeId, referrerId, userId: session.userId })
    revalidateReferral([refereeId, referrerId])
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link referrer." }
  }
}

/** The free check-up / treatment happened, or the discount was given outside an invoice. */
export async function markRewardUsedAction(referralId: string, note: string, patientId: string) {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await referralService.markRewardUsed(referralId, note, session.userId)
    revalidateReferral([patientId])
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update reward." }
  }
}

/** Lazily assign + return a patient's referral code, for the "Refer & Earn" share. */
export async function ensureReferralCodeAction(patientId: string): Promise<{ code?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    const code = await referralService.ensureCode(patientId)
    return { code }
  } catch {
    return { error: "Could not generate a referral code." }
  }
}

export async function grantReferralRewardAction(input: unknown): Promise<{ success?: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  const parsed = grantSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  try {
    await referralService.grantReward({ ...parsed.data, grantedById: session.userId })
    revalidatePath("/admin/referrals")
    revalidatePath("/patients", "layout")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to grant reward." }
  }
}
