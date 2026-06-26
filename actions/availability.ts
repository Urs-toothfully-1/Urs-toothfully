"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { availabilityRepository } from "@/server/repositories/availability.repository"

export type AvailabilityFormState = { success?: boolean; error?: string }

export async function upsertAvailabilityAction(
  _prev: AvailabilityFormState,
  formData: FormData
): Promise<AvailabilityFormState> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const doctorId = formData.get("doctorId")?.toString()
  const branchId = formData.get("branchId")?.toString()
  const startTime = formData.get("startTime")?.toString()
  const endTime = formData.get("endTime")?.toString()
  const effectiveFrom = formData.get("effectiveFrom")?.toString()

  if (!doctorId || !branchId || !startTime || !endTime || !effectiveFrom) {
    return { error: "All fields are required." }
  }

  // Collect selected working days
  const allDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  const selected = allDays.filter((d) => formData.get(`day_${d}`) === "on")
  if (selected.length === 0) return { error: "Select at least one working day." }

  try {
    await availabilityRepository.upsert({
      doctorId,
      branchId,
      workingDays: selected.join(","),
      startTime,
      endTime,
      effectiveFrom: new Date(effectiveFrom),
    })
    revalidatePath("/admin/availability")
    return { success: true }
  } catch {
    return { error: "Failed to save availability." }
  }
}
