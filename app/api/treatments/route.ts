import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { treatmentRepository } from "@/server/repositories/treatment.repository"

export async function GET() {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const all = await treatmentRepository.findAll()
    // The list is needed to write prescriptions; the price only with price access.
    const treatments = session.perms.prices ? all : all.map((t) => ({ ...t, defaultAmount: 0 }))
    return NextResponse.json({ treatments })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
