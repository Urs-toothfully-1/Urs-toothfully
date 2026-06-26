"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import type { DentalHistory } from "@prisma/client"

export type DentalHistoryFormState = {
  success?: boolean
  error?: string
}

type DentalHistoryData = Omit<
  DentalHistory,
  "id" | "patientId" | "version" | "isLatest" | "createdById" | "createdAt"
>

function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key)?.toString().trim()
  return v || null
}

export async function saveDentalHistoryAction(
  patientId: string,
  _prevState: DentalHistoryFormState,
  formData: FormData
): Promise<DentalHistoryFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "You do not have permission to update dental history." }

  const consentGiven = bool(formData, "consentGiven")
  if (!consentGiven) {
    return { error: "Patient consent is required before saving the dental history." }
  }

  const data: DentalHistoryData = {
    allergies: bool(formData, "allergies"),
    allergiesDetail: str(formData, "allergiesDetail"),
    diabetes: bool(formData, "diabetes"),
    epilepsy: bool(formData, "epilepsy"),
    epilepsyDetail: str(formData, "epilepsyDetail"),
    fainting: bool(formData, "fainting"),
    hepatitis: bool(formData, "hepatitis"),
    hepatitisType: str(formData, "hepatitisType"),
    hivAids: bool(formData, "hivAids"),
    heartProblems: bool(formData, "heartProblems"),
    heartProblemsDetail: str(formData, "heartProblemsDetail"),
    heartSurgery: bool(formData, "heartSurgery"),
    heartSurgeryDetail: str(formData, "heartSurgeryDetail"),
    bloodPressure: bool(formData, "bloodPressure"),
    bloodPressureType: str(formData, "bloodPressureType"),
    kidneyLiver: bool(formData, "kidneyLiver"),
    respiratory: bool(formData, "respiratory"),
    sinus: bool(formData, "sinus"),
    bleedsEasily: bool(formData, "bleedsEasily"),
    smoker: bool(formData, "smoker"),
    pregnant: bool(formData, "pregnant"),
    currentMedications: str(formData, "currentMedications"),
    otherDisease: str(formData, "otherDisease"),
    generalHealthNotes: str(formData, "generalHealthNotes"),
    dentalReasonForVisit: str(formData, "dentalReasonForVisit"),
    previousTreatment: str(formData, "previousTreatment"),
    lastDentistVisit: str(formData, "lastDentistVisit"),
    lastXRay: str(formData, "lastXRay"),
    foodCatching: bool(formData, "foodCatching"),
    gumsBleed: bool(formData, "gumsBleed"),
    looseTeeth: bool(formData, "looseTeeth"),
    sensitiveTeeth: bool(formData, "sensitiveTeeth"),
    grinding: bool(formData, "grinding"),
    jawPain: bool(formData, "jawPain"),
    snoring: bool(formData, "snoring"),
    appearanceConcern: bool(formData, "appearanceConcern"),
    seenSpecialist: bool(formData, "seenSpecialist"),
    wisdomTeethRemoved: bool(formData, "wisdomTeethRemoved"),
    consentGiven: true,
    consentDate: new Date(),
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
