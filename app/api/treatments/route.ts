import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { treatmentRepository } from "@/server/repositories/treatment.repository"

export async function GET() {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const treatments = await treatmentRepository.findAll()
    return NextResponse.json({ treatments })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
