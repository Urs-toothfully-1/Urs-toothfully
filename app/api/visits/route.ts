import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { visitRepository } from "@/server/repositories/visit.repository"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const patientId = request.nextUrl.searchParams.get("patientId")
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }
    const visits = await visitRepository.findByPatient(patientId)
    return NextResponse.json({ visits })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
