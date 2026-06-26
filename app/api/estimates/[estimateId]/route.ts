import { NextRequest, NextResponse } from "next/server"
import { requireRole, getSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { estimateService } from "@/server/services/estimate.service"

type Params = { params: Promise<{ estimateId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await getSession().then((s) => { if (!s) throw new Error("UNAUTHORIZED") })
    const { estimateId } = await params
    const estimate = await estimateRepository.findById(estimateId)
    if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ estimate })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { estimateId } = await params
    const body = await request.json()
    if (!body.reason) return NextResponse.json({ error: "Reason required" }, { status: 400 })
    await estimateService.softDelete(estimateId, session.userId, body.reason)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
