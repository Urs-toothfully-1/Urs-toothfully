import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name:    z.string().min(1).max(100),
  finding: z.string().min(1).max(500),
})

export async function GET() {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.examinationTemplate.findMany({
    where: { doctorId: session.userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, finding: true },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const template = await prisma.examinationTemplate.create({
    data: { ...parsed.data, doctorId: session.userId },
    select: { id: true, name: true, finding: true },
  })
  return NextResponse.json(template, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await requireRole(["DOCTOR", "ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const tpl = await prisma.examinationTemplate.findUnique({ where: { id } })
  if (!tpl || tpl.doctorId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.examinationTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
