"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { TREATMENT_CATEGORIES } from "@/lib/constants"
import { z } from "zod"

export type TreatmentFormState = { success?: boolean; error?: string }

const treatmentSchema = z.object({
  category: z.string().min(1, "Category is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  defaultAmount: z.number().positive("Amount must be positive"),
})

export async function createTreatmentAction(
  _prev: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const raw = {
    category: formData.get("category")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    defaultAmount: parseFloat(formData.get("defaultAmount")?.toString() ?? "0"),
  }

  const parsed = treatmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await treatmentRepository.create({ ...parsed.data, createdById: session.userId })
    revalidatePath("/admin/treatments")
    return { success: true }
  } catch {
    return { error: "Failed to create treatment. Please try again." }
  }
}

export async function updateTreatmentAction(
  id: string,
  _prev: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const name = formData.get("name")?.toString().trim()
  const defaultAmount = parseFloat(formData.get("defaultAmount")?.toString() ?? "0")

  if (!name || defaultAmount <= 0) return { error: "Name and valid amount are required." }

  try {
    await treatmentRepository.update(id, { name, defaultAmount })
    revalidatePath("/admin/treatments")
    return { success: true }
  } catch {
    return { error: "Failed to update treatment." }
  }
}

export async function deleteTreatmentAction(
  id: string,
  reason: string
): Promise<TreatmentFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }
  if (!reason.trim()) return { error: "Reason is required" }

  try {
    await treatmentRepository.softDelete(id, session.userId, reason)
    revalidatePath("/admin/treatments")
    return { success: true }
  } catch {
    return { error: "Failed to delete treatment." }
  }
}
