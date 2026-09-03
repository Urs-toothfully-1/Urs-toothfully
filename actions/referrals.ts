"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/auth"
import { referralService } from "@/server/services/referral.service"

const grantSchema = z.object({
  referralId: z.string().uuid(),
  type: z.enum(["MONETARY", "DISCOUNT_CREDIT"]),
  amount: z.coerce.number().positive("Amount must be greater than 0.").finite(),
  note: z.string().trim().max(300).optional(),
})

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
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to grant reward." }
  }
}
