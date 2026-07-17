"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Gender } from "@prisma/client"
import { extractDentalHistoryData } from "@/lib/dental-history-form"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { checkBotSignals, warnIfTurnstileMissing } from "@/lib/bot-guard"
import { checkIntakeRateLimit, recordIntakeAttempt, getClientIp } from "@/lib/rate-limit"
import { validateMobile } from "@/lib/whatsapp/phone"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { WHATSAPP_TRIGGERS } from "@/lib/whatsapp/templates"

export type IntakeFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  fields?: Record<string, string>
}

const schema = z.object({
  branchId: z.string().min(1, "Please select a branch"),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(200).regex(/^[^<>]+$/, "Name contains invalid characters"),
  dateOfBirth: z
    .string()
    .date("Enter a valid date of birth")
    .refine((d) => {
      const dob = new Date(d)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const earliest = new Date()
      earliest.setFullYear(earliest.getFullYear() - 120)
      return dob <= today && dob >= earliest
    }, "Date of birth must be a real past date"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Please select your gender" }),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15).regex(/^\d+$/,"Mobile must be digits only"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  leadSource: z.string().optional(),
  reasonForVisit: z.string().max(1000).optional(),
})

async function getNextPatientId(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.patient.findFirst({
    where: { patientId: { startsWith: `PAT-${year}-` } },
    orderBy: { patientId: "desc" },
    select: { patientId: true },
  })
  const next = latest ? parseInt(latest.patientId.split("-")[2]) + 1 : 1
  return `PAT-${year}-${String(next).padStart(5, "0")}`
}

async function getIntakeBotUser() {
  // Use admin user as the "system" creator for intake registrations
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  })
  if (!admin) throw new Error("No admin user found")
  return admin
}

export async function submitIntakeAction(
  _prev: IntakeFormState,
  formData: FormData
): Promise<IntakeFormState> {
  const raw = {
    branchId: formData.get("branchId")?.toString() ?? "",
    fullName: formData.get("fullName")?.toString() ?? "",
    dateOfBirth: formData.get("dateOfBirth")?.toString() ?? "",
    gender: formData.get("gender")?.toString() ?? "",
    mobile: formData.get("mobile")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    leadSource: formData.get("leadSource")?.toString() ?? "",
    reasonForVisit: formData.get("reasonForVisit")?.toString() ?? "",
  }
  const whatsappConsent = formData.get("whatsappConsent") === "on"

  const hdrs = await headers()
  const clientIp = getClientIp(hdrs)

  // 1. Always-on bot checks — Turnstile fails open when unconfigured, these don't
  warnIfTurnstileMissing("/intake")
  const bot = checkBotSignals(formData)
  if (!bot.ok) {
    console.warn(`[security] /intake submission rejected: ${bot.reason} (ip=${clientIp || "unknown"})`)
    await recordIntakeAttempt(clientIp, false)
    return { error: bot.error, fields: raw }
  }

  // 2. Cloudflare Turnstile — registration is blocked if verification fails
  const turnstile = await verifyTurnstileToken(
    formData.get("cf-turnstile-response")?.toString() ?? null,
    clientIp || undefined
  )
  if (!turnstile.success) {
    return { error: turnstile.error ?? "Security verification failed. Please try again.", fields: raw }
  }

  // 2. Per-IP rate limit (3/hour, 20/day)
  const rateLimit = await checkIntakeRateLimit(clientIp)
  if (!rateLimit.allowed) {
    return { error: rateLimit.error, fields: raw }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    // Count invalid submissions toward the rate limit (anti-abuse).
    await recordIntakeAttempt(clientIp, false)
    const fieldErrors: Record<string, string[]> = {}
    for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (errs) fieldErrors[key] = errs
    }
    return { fieldErrors, fields: raw }
  }

  // 3. Reject fake/invalid numbers (1111111111, 1234567890, bad country codes…)
  const phone = validateMobile(parsed.data.mobile)
  if (!phone.valid) {
    await recordIntakeAttempt(clientIp, false)
    return { fieldErrors: { mobile: [phone.error ?? "Enter a valid mobile number"] }, fields: raw }
  }

  // Check if mobile already registered — do NOT reveal name or patient ID to unauthenticated callers
  const existing = await prisma.patient.findFirst({
    where: { mobile: parsed.data.mobile, isDeleted: false },
    select: { id: true },
  })
  if (existing) {
    return {
      error: "This mobile number is already registered. Please visit the front desk with your Patient ID.",
      fields: raw,
    }
  }

  try {
    const [patientId, creator] = await Promise.all([
      getNextPatientId(),
      getIntakeBotUser(),
    ])

    const patient = await prisma.patient.create({
      data: {
        patientId,
        registrationBranchId: parsed.data.branchId,
        fullName: parsed.data.fullName.trim(),
        dateOfBirth: new Date(parsed.data.dateOfBirth),
        gender: parsed.data.gender as Gender,
        mobile: parsed.data.mobile.trim(),
        email: parsed.data.email || undefined,
        address: parsed.data.address || undefined,
        leadSource: parsed.data.leadSource || "Online Form",
        reasonForVisit: parsed.data.reasonForVisit || undefined,
        createdById: creator.id,
      },
    })

    // WhatsApp consent stored with date/time/IP/version. When the patient opts
    // in we also send a registration confirmation (skips the consultation gate,
    // by clinic request). Consent is the trust boundary here.
    if (whatsappConsent) {
      await whatsappService.setConsent(patient.id, true, clientIp || undefined).catch(() => null)
      await whatsappService
        .sendTrigger({
          triggerKey: WHATSAPP_TRIGGERS.REGISTRATION_SUCCESSFUL,
          patientId: patient.id,
          variables: [patient.fullName, patient.patientId],
          branchId: patient.registrationBranchId,
          createdById: creator.id,
          skipConsultationGate: true,
        })
        .catch(() => null)
    }

    await recordIntakeAttempt(clientIp, true)

    redirect(
      `/intake/dental-history?patientId=${encodeURIComponent(patient.patientId)}&name=${encodeURIComponent(patient.fullName)}`
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Registration failed. Please try again or visit the front desk.", fields: raw }
  }
}

export async function submitIntakeDentalHistoryAction(
  _prev: IntakeFormState,
  formData: FormData
): Promise<IntakeFormState> {
  const patientId = formData.get("patientId")?.toString() ?? ""
  const patientName = formData.get("patientName")?.toString() ?? ""

  if (!patientId) return { error: "Invalid session. Please start registration again." }

  const data = extractDentalHistoryData(formData)
  if (!data.consentGiven) {
    return { error: "Please read and accept the patient consent declaration to continue." }
  }

  try {
    const [patient, creator] = await Promise.all([
      prisma.patient.findFirst({
        where: { patientId, isDeleted: false },
        select: { id: true },
      }),
      getIntakeBotUser(),
    ])

    if (!patient) return { error: "Patient record not found. Please register again." }

    await dentalHistoryRepository.create(patient.id, creator.id, data)

    redirect(
      `/intake/success?id=${encodeURIComponent(patientId)}&name=${encodeURIComponent(patientName)}`
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Failed to save your medical history. Please try again." }
  }
}
