"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import { extractDentalHistoryData } from "@/lib/dental-history-form"

export type DentalHistoryFormState = {
  success?: boolean
  error?: string
}

export async function saveDentalHistoryAction(
  patientId: string,
  _prevState: DentalHistoryFormState,
  formData: FormData
): Promise<DentalHistoryFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "You do not have permission to update dental history." }

  const data = extractDentalHistoryData(formData)
  if (!data.consentGiven) {
    return { error: "Patient consent is required before saving the dental history." }
  }

  try {
    await dentalHistoryRepository.create(patientId, session.userId, data)
    revalidatePath(`/patients/${patientId}/history`)
    revalidatePath(`/patients/${patientId}`)
    return { success: true }
  } catch {
    return { error: "Failed to save dental history. Please try again." }
  }
}
