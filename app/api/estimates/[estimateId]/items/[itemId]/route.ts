import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { estimateService } from "@/server/services/estimate.service"

type Params = { params: Promise<{ estimateId: string; itemId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR"])
    const { itemId } = await params
    const { status } = await request.json()
    if (!status) return NextResponse.json({ error: "status required" }, { status: 400 })
    const item = await estimateService.updateItemStatus(itemId, status, session.userId)
    return NextResponse.json({ item })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
