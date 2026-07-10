"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { prescriptionService, updatePrescriptionSchema } from "@/server/services/prescription.service"

export type PrescriptionFormState = {
  success?: boolean
  error?: string
}

/** Ensures a prescription exists for a visit (e.g. treatment session) and returns its id. */
export async function ensureVisitPrescriptionAction(
  visitId: string
): Promise<{ success: boolean; prescriptionId?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Only doctors can create prescriptions." }
  try {
    const prescription = await prescriptionService.ensureForVisit(visitId, session.userId)
    return { success: true, prescriptionId: prescription.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create prescription." }
  }
}

/**
 * Create-on-save: only creates the visit's prescription when the doctor saves
 * real data. An accidental open with no data creates nothing.
 */
export async function saveNewVisitPrescriptionAction(
  visitId: string,
  _prevState: PrescriptionFormState,
  formData: FormData
): Promise<PrescriptionFormState & { prescriptionId?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Only doctors can create prescriptions." }

  let payload: any
  try {
    payload = JSON.parse(formData.get("payload")?.toString() ?? "{}")
  } catch {
    return { error: "Invalid form data." }
  }

  const hasContent =
    (payload.chiefComplaint?.trim?.() ?? "") !== "" ||
    (payload.onExamination?.length ?? 0) > 0 ||
    (payload.treatments?.length ?? 0) > 0 ||
    (payload.medicines?.length ?? 0) > 0 ||
    (payload.advice?.trim?.() ?? "") !== ""
  if (!hasContent) {
    return { error: "Add some details (complaint, examination, treatment, medicine or advice) before saving." }
  }

  const parsed = updatePrescriptionSchema.safeParse(payload)
  if (!parsed.success) return { error: "Please check the entries — some fields are invalid." }

  try {
    const prescription = await prescriptionService.ensureForVisit(visitId, session.userId)
    await prescriptionService.update(prescription.id, parsed.data, session.userId)
    return { success: true, prescriptionId: prescription.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save prescription." }
  }
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
