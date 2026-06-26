import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"

type Params = { params: Promise<{ patientId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const { patientId } = await params

    const [latest, all] = await Promise.all([
      dentalHistoryRepository.findLatestByPatient(patientId),
      dentalHistoryRepository.findAllByPatient(patientId),
    ])

    return NextResponse.json({ latest, versions: all })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN", "RECEPTIONIST"])
    const { patientId } = await params
    const body = await request.json()

    if (!body.consentGiven) {
      return NextResponse.json(
        { error: "Patient consent is required" },
        { status: 400 }
      )
    }

    const history = await dentalHistoryRepository.create(patientId, session.userId, body)
    return NextResponse.json({ history }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
