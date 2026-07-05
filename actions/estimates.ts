"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { estimateService } from "@/server/services/estimate.service"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import type { ItemStatus } from "@prisma/client"

export type EstimateFormState = {
  error?: string
  estimateId?: string
}

export async function createEstimateAction(
  _prev: EstimateFormState,
  formData: FormData
): Promise<EstimateFormState> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const patientId = formData.get("patientId")?.toString()
  const branchId = formData.get("branchId")?.toString() ?? session.branchId
  const visitId = formData.get("visitId")?.toString()
  const itemsJson = formData.get("itemsJson")?.toString()
  const discountPercent = formData.get("discountPercent")?.toString()
  const notes = formData.get("notes")?.toString()

  if (!patientId || !visitId || !itemsJson) {
    return { error: "Missing required fields." }
  }

  interface RawEstimateItem {
    treatmentId?: string
    treatmentName?: string
    category?: string
    toothNumber?: string
    quantity?: string | number
    unitRate?: string | number
  }
  let items: RawEstimateItem[]
  try {
    items = JSON.parse(itemsJson)
  } catch {
    return { error: "Invalid estimate items." }
  }

  if (!items.length) {
    return { error: "At least one treatment item is required." }
  }

  const invalids = items.filter((i) => !i.treatmentName?.trim() || !i.quantity || !i.unitRate)
  if (invalids.length > 0) {
    return { error: "All items must have a treatment name, quantity, and rate." }
  }

  try {
    const estimate = await estimateService.create(
      {
        patientId,
        branchId,
        visitId,
        discountPercent: discountPercent ? parseFloat(discountPercent) : undefined,
        notes: notes || undefined,
        items: items.map((item, idx) => ({
          treatmentId: item.treatmentId || undefined,
          treatmentName: (item.treatmentName ?? "").trim(),
          category: item.category || "OTHER",
          toothNumber: item.toothNumber || undefined,
          quantity: parseInt(String(item.quantity), 10),
          unitRate: parseFloat(String(item.unitRate)),
          sortOrder: idx,
        })),
      },
      session.userId
    )

    revalidatePath(`/patients/${patientId}/estimates`)
    revalidatePath(`/patients/${patientId}/progress`)
    redirect(`/doctor/estimate/${estimate.id}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to save estimate. Please try again." }
  }
}

export async function updateItemStatusAction(
  itemId: string,
  estimateId: string,
  patientId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    await estimateService.updateItemStatus(itemId, status as ItemStatus, session.userId)
    revalidatePath(`/patients/${patientId}/progress`)
    revalidatePath(`/patients/${patientId}/estimates`)
    revalidatePath(`/doctor/estimate/${estimateId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update status." }
  }
}
