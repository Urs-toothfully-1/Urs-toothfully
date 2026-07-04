import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { templateService } from "@/server/services/whatsapp/template.service"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    await requireRole(["ADMIN", "RECEPTIONIST"])
    const { templateId } = await params
    const template = await templateService.getById(templateId)
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ template })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const session = await requireRole(["ADMIN"])
    const { templateId } = await params
    const body = await request.json()
    const template = await templateService.update(templateId, body, session.userId)
    return NextResponse.json({ template })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update template"
    const status = ["UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const session = await requireRole(["ADMIN"])
    const { templateId } = await params
    await templateService.delete(templateId, session.userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete template"
    const status = ["UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
