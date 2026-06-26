import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { estimateService, createEstimateSchema } from "@/server/services/estimate.service"
import { estimateRepository } from "@/server/repositories/estimate.repository"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const patientId = request.nextUrl.searchParams.get("patientId")
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })
    const estimates = await estimateRepository.findByPatient(patientId)
    return NextResponse.json({ estimates })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR"])
    const body = await request.json()
    const parsed = createEstimateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }
    const estimate = await estimateService.create(parsed.data, session.userId)
    return NextResponse.json({ estimate }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
