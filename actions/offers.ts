"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canSeePatient } from "@/server/services/patient-scope.service"
import { offerService } from "@/server/services/offer.service"

type Result = { success?: boolean; error?: string }

const eventSchema = z.object({
  name: z.string().min(2).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  tiers: z
    .array(z.object({ minutes: z.number().int().positive().max(100_000).nullable(), offer: z.string().min(2).max(200) }))
    .min(1)
    .max(6),
  terms: z.string().max(1000).optional(),
})

/** Create an event offer (Rewards page). Times arrive as ISO strings from the browser. */
export async function createOfferEventAction(input: z.input<typeof eventSchema>): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only admins can create event offers." }
  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) return { error: "Please fill in the name, times and every offer." }
  try {
    await offerService.create(
      { ...parsed.data, startsAt: new Date(parsed.data.startsAt), endsAt: new Date(parsed.data.endsAt) },
      session.userId
    )
    revalidatePath("/admin/referrals")
    revalidatePath("/book")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the event." }
  }
}

/** Start the countdown now, e.g. the moment the flyer goes out. */
export async function startOfferEventNowAction(id: string): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only admins can start an event." }
  try {
    await offerService.startNow(id, session.userId)
    revalidatePath("/admin/referrals")
    revalidatePath("/book")
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start the event." }
  }
}

export async function setOfferEventActiveAction(id: string, isActive: boolean): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only admins can change events." }
  await offerService.setActive(id, isActive, session.userId)
  revalidatePath("/admin/referrals")
  revalidatePath("/book")
  return { success: true }
}

export async function deleteOfferEventAction(id: string): Promise<Result> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only admins can delete events." }
  try {
    await offerService.remove(id, session.userId)
  } catch {
    return { error: "Could not delete the event." }
  }
  revalidatePath("/admin/referrals")
  revalidatePath("/book")
  revalidatePath("/rewards")
  return { success: true }
}

/** Reception/doctor marks a patient's event offer as given (or undoes it). */
export async function markOfferGivenAction(patientOfferId: string, given: boolean): Promise<Result> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  const row = await prisma.patientOffer.findUnique({ where: { id: patientOfferId }, select: { patientId: true } })
  if (!row || !(await canSeePatient(session, row.patientId))) return { error: "Offer not found." }
  await offerService.markGiven(patientOfferId, given, session.userId)
  revalidatePath(`/patients/${row.patientId}`, "layout")
  revalidatePath("/admin/referrals")
  return { success: true }
}
