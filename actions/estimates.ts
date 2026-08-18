"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { estimateService } from "@/server/services/estimate.service"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { treatmentIdOrNull } from "@/lib/estimate-item"
import { numericSetting } from "@/lib/settings-value"
import { createAuditLog } from "@/lib/audit"
import { Decimal } from "@prisma/client/runtime/library"
import type { ItemStatus } from "@prisma/client"

export type EstimateFormState = {
  error?: string
  estimateId?: string
  success?: boolean
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
  const stayInWizard = formData.get("stayInWizard")?.toString() === "true"

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
    plannedSittings?: string | number
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
          treatmentId: treatmentIdOrNull(item.treatmentId),
          treatmentName: (item.treatmentName ?? "").trim(),
          category: item.category || "OTHER",
          toothNumber: item.toothNumber || undefined,
          quantity: parseInt(String(item.quantity), 10),
          unitRate: parseFloat(String(item.unitRate)),
          plannedSittings: item.plannedSittings ? Math.max(1, parseInt(String(item.plannedSittings), 10)) : 1,
          sortOrder: idx,
        })),
      },
      session.userId
    )

    revalidatePath(`/patients/${patientId}/estimates`)
    revalidatePath(`/patients/${patientId}/progress`)
    if (stayInWizard) {
      revalidatePath(`/doctor/consultation/${visitId}`)
      return { success: true, estimateId: estimate.id }
    }
    redirect(`/doctor/estimate/${estimate.id}/wizard`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to save estimate. Please try again." }
  }
}

export async function updateEstimateAction(
  _prev: EstimateFormState,
  formData: FormData
): Promise<EstimateFormState> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const estimateId = formData.get("estimateId")?.toString()
  const patientId = formData.get("patientId")?.toString()
  const branchId = formData.get("branchId")?.toString() ?? session.branchId
  const itemsJson = formData.get("itemsJson")?.toString()
  const discountPercent = formData.get("discountPercent")?.toString()
  const notes = formData.get("notes")?.toString()
  const stayInWizard = formData.get("stayInWizard")?.toString() === "true"
  const rawReturn = formData.get("returnHref")?.toString()
  // Only internal absolute paths — never off-site / protocol-relative.
  const returnHref = rawReturn?.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : undefined

  if (!estimateId || !patientId || !itemsJson) return { error: "Missing required fields." }

  interface RawItem {
    id?: string
    treatmentId?: string; treatmentName?: string; category?: string
    toothNumber?: string; quantity?: string | number; unitRate?: string | number
    plannedSittings?: string | number
  }
  let items: RawItem[]
  try { items = JSON.parse(itemsJson) } catch { return { error: "Invalid estimate items." } }
  if (!items.length) return { error: "At least one treatment item is required." }
  if (items.some((i) => !i.treatmentName?.trim() || !i.quantity || !i.unitRate))
    return { error: "All items must have a treatment name, quantity, and rate." }

  try {
    const mappedItems = items.map((item, idx) => {
      const qty = parseInt(String(item.quantity), 10)
      const rate = parseFloat(String(item.unitRate))
      return {
        id: item.id && !item.id.startsWith("new-") ? item.id : undefined,
        treatmentId: treatmentIdOrNull(item.treatmentId),
        treatmentName: (item.treatmentName ?? "").trim(),
        category: item.category || "OTHER",
        toothNumber: item.toothNumber || undefined,
        quantity: qty,
        unitRate: new Decimal(rate),
        amount: new Decimal(qty * rate),
        plannedSittings: item.plannedSittings ? Math.max(1, parseInt(String(item.plannedSittings), 10)) : 1,
        sortOrder: idx,
      }
    })

    const subtotal = mappedItems.reduce((s, i) => s + i.amount.toNumber(), 0)
    const disc = discountPercent ? parseFloat(discountPercent) : 0
    const discountAmount = disc > 0 ? (subtotal * disc) / 100 : 0
    const total = subtotal - discountAmount

    const advancePct = await settingsRepository.get("advance_percent", branchId)
    const advanceRequired = total * (numericSetting("advance_percent", advancePct) / 100)
    if (!Number.isFinite(total) || !Number.isFinite(advanceRequired)) {
      return { error: "The estimate totals could not be calculated. Check the branch settings." }
    }

    await estimateRepository.update(estimateId, {
      subtotal: new Decimal(subtotal),
      total: new Decimal(total),
      advanceRequired: new Decimal(advanceRequired),
      discountPercent: disc > 0 ? new Decimal(disc) : null,
      discountAmount: discountAmount > 0 ? new Decimal(discountAmount) : null,
      notes: notes || null,
      items: mappedItems,
    })

    revalidatePath(`/patients/${patientId}/estimates`)
    revalidatePath(`/patients/${patientId}/progress`)
    if (stayInWizard) {
      revalidatePath(`/doctor/estimate/${estimateId}/wizard`)
      return { success: true, estimateId }
    }
    redirect(returnHref ?? `/doctor/estimate/${estimateId}/wizard`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to update estimate. Please try again." }
  }
}

/**
 * Applies a discount from the Payment Plan step, where all the money is now
 * decided. Recomputes the estimate's totals from its saved items — the rows
 * themselves are untouched, so treatment progress is preserved.
 */
export async function updateEstimateDiscountAction(
  estimateId: string,
  discountPercent: number
): Promise<{ success?: boolean; error?: string; subtotal?: number; total?: number; discountAmount?: number }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return { error: "Discount must be between 0 and 100." }
  }

  try {
    const estimate = await estimateRepository.findById(estimateId)
    if (!estimate) return { error: "Estimate not found." }

    const allowDiscount = await settingsRepository.get("allow_discount", estimate.branchId)
    if ((allowDiscount ?? "true") !== "true" && discountPercent > 0) {
      return { error: "Discounts are turned off for this branch." }
    }

    const subtotal = (estimate.items as { amount: unknown }[]).reduce((s, i) => s + Number(i.amount), 0)
    const discountAmount = (subtotal * discountPercent) / 100
    const total = subtotal - discountAmount

    const advancePct = await settingsRepository.get("advance_percent", estimate.branchId)
    const advanceRequired = total * (numericSetting("advance_percent", advancePct) / 100)
    if (![subtotal, total, advanceRequired].every(Number.isFinite)) {
      return { error: "The estimate totals could not be calculated." }
    }

    await estimateRepository.updateTotals(estimateId, {
      subtotal: new Decimal(subtotal),
      total: new Decimal(total),
      advanceRequired: new Decimal(advanceRequired),
      discountPercent: discountPercent > 0 ? new Decimal(discountPercent) : null,
      discountAmount: discountAmount > 0 ? new Decimal(discountAmount) : null,
    })

    await createAuditLog({
      entityType: "Estimate",
      entityId: estimateId,
      action: "UPDATE",
      changedById: session.userId,
      previousValues: { discountPercent: estimate.discountPercent ? Number(estimate.discountPercent) : 0, total: Number(estimate.total) },
      newValues: { discountPercent, total },
      branchId: estimate.branchId,
    })

    revalidatePath(`/patients/${estimate.patientId}/estimates`)
    return { success: true, subtotal, total, discountAmount }
  } catch {
    return { error: "Failed to apply the discount. Please try again." }
  }
}

export async function updateItemSittingsAction(
  itemId: string,
  patientId: string,
  data: { plannedSittings?: number; completedSittings?: number; status?: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Unauthorized" }

  try {
    await estimateService.updateItemSittings(
      itemId,
      {
        plannedSittings: data.plannedSittings,
        completedSittings: data.completedSittings,
        status: data.status as ItemStatus | undefined,
      },
      session.userId
    )
    revalidatePath(`/patients/${patientId}/progress`)
    revalidatePath(`/patients/${patientId}/estimates`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update sittings." }
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
