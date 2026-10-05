"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import { requireRole } from "@/lib/auth"
import { rewardService, type RedeemInput } from "@/server/services/reward.service"

type Result = { success?: boolean; error?: string }

function fail(e: unknown, fallback: string): Result {
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Please check the entries." }
  return { error: e instanceof Error ? e.message : fallback }
}

function refresh(patientId?: string) {
  revalidatePath("/admin/referrals")
  if (patientId) revalidatePath(`/patients/${patientId}`, "layout")
}

// ─── Campaigns (admin) ───────────────────────────────────────

export async function saveCampaignAction(id: string | null, input: unknown): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only an administrator can manage campaigns." }
  try {
    if (id) await rewardService.updateCampaign(id, input, session.userId)
    else await rewardService.createCampaign(input, session.userId)
    refresh()
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to save the campaign.")
  }
}

export async function setCampaignActiveAction(id: string, isActive: boolean): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await rewardService.setCampaignActive(id, isActive, session.userId)
    refresh()
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to update the campaign.")
  }
}

export async function deleteCampaignAction(id: string): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await rewardService.deleteCampaign(id, session.userId)
    refresh()
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to delete the campaign.")
  }
}

// ─── Points (doctor / admin) ─────────────────────────────────

export async function redeemPointsAction(input: RedeemInput): Promise<Result> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Only a doctor can give referral rewards." }
  try {
    await rewardService.redeem(input, session.userId, session.branchId)
    refresh(input.patientId)
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to give the reward.")
  }
}

export async function markRewardUsedAction(id: string, note: string, patientId: string): Promise<Result> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await rewardService.markUsed(id, note, session.userId)
    refresh(patientId)
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to update the reward.")
  }
}

/** Undo a reward given by mistake — its points become available again. */
export async function cancelRewardAction(id: string, patientId: string): Promise<Result> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  try {
    await rewardService.cancelRedemption(id, session.userId)
    refresh(patientId)
    return { success: true }
  } catch (e) {
    return fail(e, "Failed to cancel the reward.")
  }
}
