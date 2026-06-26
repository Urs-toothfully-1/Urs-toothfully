"use server"

import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { patientService, createPatientSchema } from "@/server/services/patient.service"

export type PatientFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  fields?: Record<string, string>
}

export async function registerPatientAction(
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const raw = {
    registrationBranchId: formData.get("registrationBranchId")?.toString() ?? "",
    fullName: formData.get("fullName")?.toString() ?? "",
    dateOfBirth: formData.get("dateOfBirth")?.toString() ?? "",
    gender: formData.get("gender")?.toString() ?? "",
    mobile: formData.get("mobile")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    leadSource: formData.get("leadSource")?.toString() ?? "",
    referenceName: formData.get("referenceName")?.toString() ?? "",
    reasonForVisit: formData.get("reasonForVisit")?.toString() ?? "",
  }

  const parsed = createPatientSchema.safeParse(raw)

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (errs) fieldErrors[key] = errs
    }
    return { fieldErrors, fields: raw }
  }

  try {
    const patient = await patientService.create(parsed.data, session.userId)
    redirect(`/patients/${patient.id}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to register patient. Please try again." }
  }
}

export async function updatePatientAction(
  id: string,
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"]).catch(() => null)
  if (!session) return { error: "Unauthorized" }

  const raw = {
    fullName: formData.get("fullName")?.toString(),
    dateOfBirth: formData.get("dateOfBirth")?.toString(),
    gender: formData.get("gender")?.toString(),
    mobile: formData.get("mobile")?.toString(),
    email: formData.get("email")?.toString(),
    address: formData.get("address")?.toString(),
    leadSource: formData.get("leadSource")?.toString(),
    referenceName: formData.get("referenceName")?.toString(),
    reasonForVisit: formData.get("reasonForVisit")?.toString(),
  }

  try {
    await patientService.update(id, raw as Parameters<typeof patientService.update>[1], session.userId)
    return {}
  } catch {
    return { error: "Failed to update patient. Please try again." }
  }
}
