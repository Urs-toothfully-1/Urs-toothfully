import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { templateService } from "@/server/services/whatsapp/template.service"
import type { WhatsAppTemplateCategory, WhatsAppTemplateStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    // Receptionists can list templates (needed for manual sending)
    await requireRole(["ADMIN", "RECEPTIONIST"])
    const sp = request.nextUrl.searchParams
    const templates = await templateService.list({
      search: sp.get("search") ?? undefined,
      category: (sp.get("category") as WhatsAppTemplateCategory) ?? undefined,
      status: (sp.get("status") as WhatsAppTemplateStatus) ?? undefined,
      enabledOnly: sp.get("enabledOnly") === "true",
    })
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"])
    const body = await request.json()
    const template = await templateService.create(body, session.userId)
    return NextResponse.json({ template }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create template"
    const status = ["UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
