"use server"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { Gender } from "@prisma/client"

export type IntakeFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  fields?: Record<string, string>
}

const schema = z.object({
  branchId: z.string().uuid("Please select a branch"),
  fullName: z.string().min(2, "Name must be at least 2 characters").max(200),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
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

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const [key, errs] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (errs) fieldErrors[key] = errs
    }
    return { fieldErrors, fields: raw }
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

    redirect(
      `/intake/success?id=${encodeURIComponent(patient.patientId)}&name=${encodeURIComponent(patient.fullName)}`
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err
    return { error: "Registration failed. Please try again or visit the front desk.", fields: raw }
  }
}
