import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "RECEPTIONIST"])
    const body = await request.json()
    const message = await whatsappService.sendManual({
      patientId: body.patientId,
      templateId: body.templateId,
      variables: Array.isArray(body.variables) ? body.variables.map(String) : [],
      branchId: session.branchId,
      createdById: session.userId,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to queue message"
    const status = ["UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
