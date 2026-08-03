import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { patientService, createPatientSchema } from "@/server/services/patient.service"
import { patientRepository } from "@/server/repositories/patient.repository"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const q = request.nextUrl.searchParams.get("q") ?? ""

    if (q.trim().length < 2) {
      return NextResponse.json({ patients: [] })
    }

    // Branch isolation: non-admin roles only see patients registered at their
    // own branch; ADMIN searches across all branches.
    const branchId = session.role === "ADMIN" ? undefined : session.branchId
    const patients = await patientRepository.search(q, 1, branchId)
    return NextResponse.json({ patients })
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Unexpected failure (e.g. DB error) must not masquerade as a 401.
    console.error("[GET /api/patients] unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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

    // A syntactically valid but non-existent branch id used to reach Prisma and
    // come back as a 500. It's bad input, so answer 400.
    const branch = await prisma.branch.findUnique({
      where: { id: parsed.data.registrationBranchId },
      select: { id: true, isActive: true },
    })
    if (!branch || !branch.isActive) {
      return NextResponse.json(
        { error: "Validation failed", details: { fieldErrors: { registrationBranchId: ["Unknown or inactive branch"] } } },
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
    console.error("[POST /api/patients] unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
