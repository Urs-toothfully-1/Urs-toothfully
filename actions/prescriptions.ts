"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { prescriptionService, updatePrescriptionSchema } from "@/server/services/prescription.service"

export type PrescriptionFormState = {
  success?: boolean
  error?: string
}

export async function updatePrescriptionAction(
  prescriptionId: string,
  _prevState: PrescriptionFormState,
  formData: FormData
): Promise<PrescriptionFormState> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Only doctors can edit prescriptions." }

  let payload: unknown
  try {
    payload = JSON.parse(formData.get("payload")?.toString() ?? "{}")
  } catch {
    return { error: "Invalid form data." }
  }

  const parsed = updatePrescriptionSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: "Please check the medicine entries — some fields are invalid." }
  }

  try {
    await prescriptionService.update(prescriptionId, parsed.data, session.userId)
    revalidatePath(`/doctor/prescription/${prescriptionId}`, "page")
    return { success: true }
  } catch {
    return { error: "Failed to save prescription. Please try again." }
  }
}
