"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { checkIntakeRateLimit, recordIntakeAttempt, getClientIp } from "@/lib/rate-limit"
import { validateMobile } from "@/lib/whatsapp/phone"

export type BookingFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  fields?: Record<string, string>
}

const schema = z.object({
  branchId: z.string().min(1, "Please choose a clinic"),
  fullName: z.string().min(2, "Please enter your name").max(200).regex(/^[^<>]+$/, "Name contains invalid characters"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15).regex(/^\d+$/, "Mobile must be digits only"),
  preferredDate: z.string().min(1, "Please pick a date"),
  problem: z.string().max(500).optional(),
})

export async function submitAppointmentRequestAction(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const raw = {
    branchId: formData.get("branchId")?.toString() ?? "",
    fullName: formData.get("fullName")?.toString() ?? "",
    mobile: formData.get("mobile")?.toString() ?? "",
    preferredDate: formData.get("preferredDate")?.toString() ?? "",
    problem: formData.get("problem")?.toString() ?? "",
  }
  const whatsappConsent = formData.get("whatsappConsent") === "on"

  const hdrs = await headers()
  const clientIp = getClientIp(hdrs)

  const turnstile = await verifyTurnstileToken(
    formData.get("cf-turnstile-response")?.toString() ?? null,
    clientIp || undefined
  )
  if (!turnstile.success) {
    return { error: turnstile.error ?? "Security verification failed. Please try again.", fields: raw }
  }

  const rateLimit = await checkIntakeRateLimit(clientIp)
  if (!rateLimit.allowed) return { error: rateLimit.error, fields: raw }

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

  const phone = validateMobile(parsed.data.mobile)
  if (!phone.valid) {
    await recordIntakeAttempt(clientIp, false)
    return { fieldErrors: { mobile: [phone.error ?? "Enter a valid mobile number"] }, fields: raw }
  }

  // Reject a date in the past
  const preferred = new Date(parsed.data.preferredDate)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (Number.isNaN(preferred.getTime()) || preferred < today) {
    return { fieldErrors: { preferredDate: ["Please choose today or a future date"] }, fields: raw }
  }

  try {
    await prisma.appointmentRequest.create({
      data: {
        branchId: parsed.data.branchId,
        fullName: parsed.data.fullName.trim(),
        mobile: parsed.data.mobile.trim(),
        problem: parsed.data.problem?.trim() || undefined,
        preferredDate: preferred,
        whatsappConsent,
        consentIp: whatsappConsent ? clientIp || undefined : undefined,
      },
    })
    await recordIntakeAttempt(clientIp, true)
    redirect(`/book/success?name=${encodeURIComponent(parsed.data.fullName.trim())}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Could not submit your request. Please try again or call 7890008331.", fields: raw }
  }
}
