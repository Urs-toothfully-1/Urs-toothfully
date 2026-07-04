import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"

// ADMIN only — credentials must never reach receptionists.
export async function GET() {
  try {
    await requireRole(["ADMIN"])
    const settings = await whatsappService.getSettingsForAdmin()
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"])
    const body = await request.json()
    await whatsappService.saveSettings(body, session.userId)
    const settings = await whatsappService.getSettingsForAdmin()
    return NextResponse.json({ settings })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save settings"
    const status = ["UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
