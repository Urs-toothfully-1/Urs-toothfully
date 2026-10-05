"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { referralService } from "@/server/services/referral.service"


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

