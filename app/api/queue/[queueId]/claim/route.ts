import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { queueService } from "@/server/services/queue.service"

type Params = { params: Promise<{ queueId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["DOCTOR", "ADMIN"])
    const { queueId } = await params
    const entry = await queueService.claimPatient(queueId, session.userId)
    return NextResponse.json({ entry })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to claim" },
      { status: 400 }
    )
  }
}
