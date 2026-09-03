"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { patientService, createPatientSchema } from "@/server/services/patient.service"
import { extractDentalHistoryData } from "@/lib/dental-history-form"
import { validateMobile } from "@/lib/whatsapp/phone"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { referralService } from "@/server/services/referral.service"

export type DuplicateInfo = {
  /** MOBILE = hard block (open existing); NAME_DOB = warning (receptionist decides) */
  type: "MOBILE" | "NAME_DOB"
  matches: Array<{ id: string; patientId: string; fullName: string; mobile: string }>
}

export type PatientFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  fields?: Record<string, string>
  duplicate?: DuplicateInfo
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

  const phone = validateMobile(parsed.data.mobile)
  if (!phone.valid) {
    return { fieldErrors: { mobile: [phone.error ?? "Enter a valid mobile number"] }, fields: raw }
  }

  const duplicates = await patientService.findDuplicates({
    mobile: parsed.data.mobile,
    fullName: parsed.data.fullName,
    dateOfBirth: parsed.data.dateOfBirth,
    email: parsed.data.email || undefined,
  })
  if (duplicates.mobileMatch) {
    return { fields: raw, duplicate: { type: "MOBILE", matches: [duplicates.mobileMatch] } }
  }

  try {
    const patient = await patientService.create(parsed.data, session.userId)
    redirect(`/patients/${patient.id}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to register patient. Please try again." }
  }
}

/**
 * Two-page intake: registers the patient AND saves dental history v1 from a
 * single combined form submission (atomic).
 */
export async function registerPatientWithHistoryAction(
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

  // Reject fake/invalid numbers (1111111111, 1234567890, bad country codes…)
  const phone = validateMobile(parsed.data.mobile)
  if (!phone.valid) {
    return { fieldErrors: { mobile: [phone.error ?? "Enter a valid mobile number"] }, fields: raw }
  }

  // Duplicate detection: mobile is a hard block; name+DOB/email is a warning
  // the receptionist can override by resubmitting with confirmDuplicate=true.
  const duplicates = await patientService.findDuplicates({
    mobile: parsed.data.mobile,
    fullName: parsed.data.fullName,
    dateOfBirth: parsed.data.dateOfBirth,
    email: parsed.data.email || undefined,
  })
  if (duplicates.mobileMatch) {
    return {
      fields: raw,
      duplicate: { type: "MOBILE", matches: [duplicates.mobileMatch] },
    }
  }
  const confirmDuplicate = formData.get("confirmDuplicate")?.toString() === "true"
  if (duplicates.nameDobMatches.length > 0 && !confirmDuplicate) {
    return {
      fields: raw,
      duplicate: { type: "NAME_DOB", matches: duplicates.nameDobMatches },
    }
  }

  const history = extractDentalHistoryData(formData)
  if (!history.consentGiven) {
    return { error: "Patient consent is required before completing registration.", fields: raw }
  }

  const whatsappConsent = formData.get("whatsappConsent") === "on"
  const referralCode = formData.get("referralCode")?.toString() ?? ""

  try {
    const patient = await patientService.createWithHistory(parsed.data, history, session.userId)
    // Consent stored only — no message is sent until the consultation fee is paid.
    if (whatsappConsent) {
      await whatsappService.setConsent(patient.id, true).catch(() => null)
    }
    // Link the referral if a valid code was entered — invalid codes are ignored
    // (the free-text "how did you hear" field still captures those). Non-blocking.
    if (referralCode.trim()) {
      try {
        const referrer = await referralService.findReferrerByCode(referralCode)
        if (referrer && referrer.id !== patient.id) {
          await referralService.createReferral({
            referrerId: referrer.id, refereeId: patient.id,
            branchId: patient.registrationBranchId, createdById: session.userId,
          })
        }
      } catch { /* referral capture must never block registration */ }
    }
    redirect(`/patients/${patient.id}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to register patient. Please try again.", fields: raw }
  }
}

export async function updatePatientAction(
  id: string,
  _prevState: PatientFormState,
  formData: FormData
): Promise<PatientFormState & { success?: boolean }> {
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

  // Same rules as registration — an edit must not be able to write a value the
  // registration form would have rejected.
  const parsed = createPatientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (errs) fieldErrors[key] = errs
    }
    return { fieldErrors, fields: raw }
  }

  const phone = validateMobile(parsed.data.mobile)
  if (!phone.valid) {
    return { fieldErrors: { mobile: [phone.error ?? "Enter a valid mobile number"] }, fields: raw }
  }

  // Someone else already on this number = the two profiles are the same person.
  const duplicates = await patientService.findDuplicates({
    mobile: parsed.data.mobile,
    fullName: parsed.data.fullName,
    dateOfBirth: parsed.data.dateOfBirth,
  })
  if (duplicates.mobileMatch && duplicates.mobileMatch.id !== id) {
    return {
      fields: raw,
      fieldErrors: { mobile: [`${duplicates.mobileMatch.fullName} (${duplicates.mobileMatch.patientId}) already uses this number`] },
    }
  }

  try {
    await patientService.update(id, parsed.data, session.userId)
    revalidatePath(`/patients/${id}`, "layout")
    revalidatePath("/patients")
    return { success: true }
  } catch {
    return { error: "Failed to update patient. Please try again." }
  }
}

/**
 * Soft delete — the row, its visits, estimates and payments all stay in the
 * database (and therefore in every backup); the patient just stops appearing in
 * search, queues and reports. Recoverable by clearing isDeleted.
 */
export async function deletePatientAction(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { success: false, error: "Only an administrator can delete a patient." }
  if (!reason?.trim()) return { success: false, error: "A reason is required." }

  try {
    await patientService.softDelete(id, session.userId, reason.trim())
    revalidatePath("/patients")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete patient." }
  }
}
