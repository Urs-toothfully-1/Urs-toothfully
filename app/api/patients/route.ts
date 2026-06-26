import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { patientService, createPatientSchema } from "@/server/services/patient.service"
import { patientRepository } from "@/server/repositories/patient.repository"

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const q = request.nextUrl.searchParams.get("q") ?? ""

    if (q.trim().length < 2) {
      return NextResponse.json({ patients: [] })
    }

    const patients = await patientRepository.search(q)
    return NextResponse.json({ patients })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "RECEPTIONIST"])
    const body = await request.json()

    const parsed = createPatientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const patient = await patientService.create(parsed.data, session.userId)
    return NextResponse.json({ patient }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
