import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { visitRepository } from "@/server/repositories/visit.repository"
import { canSeePatient } from "@/server/services/patient-scope.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const patientId = request.nextUrl.searchParams.get("patientId")
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 })
    }
    if (!(await canSeePatient(session, patientId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const visits = await visitRepository.findByPatient(patientId)
    return NextResponse.json({ visits })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
