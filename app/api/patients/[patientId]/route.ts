import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { patientService } from "@/server/services/patient.service"
import { patientRepository } from "@/server/repositories/patient.repository"
import { z } from "zod"

const updatePatientSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  mobile: z.string().min(10).max(15).regex(/^\d+$/).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  leadSource: z.string().max(100).optional(),
  referenceName: z.string().max(200).optional(),
  reasonForVisit: z.string().max(1000).optional(),
})

type Params = { params: Promise<{ patientId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const { patientId } = await params
    const patient = await patientRepository.findById(patientId)
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    return NextResponse.json({ patient })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN", "RECEPTIONIST"])
    const { patientId } = await params
    const raw = await request.json()

    const parsed = updatePatientSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const patient = await patientService.update(patientId, parsed.data, session.userId)
    return NextResponse.json({ patient })
  } catch (err) {
    if (err instanceof Error && err.message === "Patient not found") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { patientId } = await params
    const body = await request.json()
    if (!body.reason) {
      return NextResponse.json({ error: "Deletion reason is required" }, { status: 400 })
    }
    await patientService.softDelete(patientId, session.userId, body.reason)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === "Patient not found") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
