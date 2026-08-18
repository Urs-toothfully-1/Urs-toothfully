"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { prescriptionService, updatePrescriptionSchema, quickRxSchema } from "@/server/services/prescription.service"
import { diagnosisService } from "@/server/services/diagnosis.service"

export type PrescriptionFormState = {
  success?: boolean
  error?: string
}

/**
 * Saves the dated clinical-notes log to a visit's prescription (creating the
 * prescription on first save). Used from the treatment session to log what was done.
 */
export async function saveVisitClinicalNotesAction(
  visitId: string,
  notes: { date: string; note: string }[]
): Promise<{ success: boolean; prescriptionId?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Only doctors can write clinical notes." }
  try {
    const prescription = await prescriptionService.ensureForVisit(visitId, session.userId)
    await prescriptionService.updateClinicalNotes(prescription.id, notes, session.userId)
    revalidatePath(`/doctor/prescription/${prescription.id}`, "page")
    return { success: true, prescriptionId: prescription.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save clinical notes." }
  }
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
    (payload.diagnosis?.trim?.() ?? "") !== "" ||
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

/**
 * Quick Rx: saves tooth-linked diagnoses + template medicines onto the visit's
 * prescription in one shot, then records diagnosis usage so the picker's
 * "Recent" list stays useful.
 */
export async function saveQuickRxAction(
  visitId: string,
  input: unknown
): Promise<{ success: boolean; prescriptionId?: string; error?: string }> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Only doctors can write prescriptions." }

  const parsed = quickRxSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the entries." }
  }
  if (parsed.data.diagnoses.length === 0 && parsed.data.medicines.length === 0) {
    return { success: false, error: "Add at least one diagnosis or medicine before saving." }
  }

  try {
    const prescription = await prescriptionService.applyQuickRx(visitId, parsed.data, session.userId)

    // Usage tracking is a convenience, not part of the clinical record — a
    // failure here must not lose the prescription the doctor just saved.
    await Promise.all(
      parsed.data.diagnoses
        .map((d) => d.diagnosisId)
        .filter((id): id is string => !!id)
        .map((id) =>
          diagnosisService
            .trackDiagnosisUsage(session.userId, id, session.branchId)
            .catch(() => undefined)
        )
    )

    revalidatePath(`/doctor/prescription/${prescription.id}`, "page")
    return { success: true, prescriptionId: prescription.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save prescription." }
  }
}
