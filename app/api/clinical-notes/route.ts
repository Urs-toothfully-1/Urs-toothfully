import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { clinicalNotesRepository } from "@/server/repositories/clinical-notes.repository"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const NOTE_TYPES = ["GENERAL", "DIAGNOSIS", "TREATMENT", "FOLLOWUP", "PRESCRIPTION"] as const

const createNoteSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  noteType: z.enum(NOTE_TYPES).optional().default("GENERAL"),
  content: z.string().min(1).max(5000),
})

async function patientBelongsToBranch(patientId: string, branchId: string): Promise<boolean> {
  const visit = await prisma.patientVisit.findFirst({
    where: { patientId, branchId },
    select: { id: true },
  })
  return visit !== null
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR"])
    const patientId = request.nextUrl.searchParams.get("patientId")
    const visitId = request.nextUrl.searchParams.get("visitId")

    if (visitId) {
      // Verify the visit belongs to the session's branch for non-ADMIN
      if (session.role !== "ADMIN") {
        const visit = await prisma.patientVisit.findUnique({ where: { id: visitId }, select: { branchId: true } })
        if (!visit || visit.branchId !== session.branchId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      const notes = await clinicalNotesRepository.findByVisit(visitId)
      return NextResponse.json({ notes })
    }
    if (patientId) {
      // Non-ADMIN: only return notes if the patient has ever visited this branch
      if (session.role !== "ADMIN") {
        const allowed = await patientBelongsToBranch(patientId, session.branchId)
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const notes = await clinicalNotesRepository.findByPatient(patientId)
      return NextResponse.json({ notes })
    }
    return NextResponse.json({ error: "patientId or visitId required" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR"])
    const raw = await request.json()

    const parsed = createNoteSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { patientId, visitId, noteType, content } = parsed.data

    // Branch ownership check for non-ADMIN
    if (session.role !== "ADMIN") {
      const visit = await prisma.patientVisit.findUnique({ where: { id: visitId }, select: { branchId: true } })
      if (!visit || visit.branchId !== session.branchId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const note = await clinicalNotesRepository.create({
      patientId,
      visitId,
      doctorId: session.userId,
      noteType,
      content,
    })
    return NextResponse.json({ note }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
  }
}
