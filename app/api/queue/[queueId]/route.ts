import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { queueService } from "@/server/services/queue.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { z } from "zod"

type Params = { params: Promise<{ queueId: string }> }

const VALID_STATUSES = z.enum([
  "WAITING", "WITH_DOCTOR", "ESTIMATE_CREATED", "PAYMENT_PENDING", "COMPLETED", "CANCELLED",
])

// Transitions allowed per role
const ROLE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DOCTOR: ["WITH_DOCTOR", "ESTIMATE_CREATED"],
  RECEPTIONIST: ["CANCELLED", "COMPLETED", "PAYMENT_PENDING"],
  ADMIN: ["WAITING", "WITH_DOCTOR", "ESTIMATE_CREATED", "PAYMENT_PENDING", "COMPLETED", "CANCELLED"],
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const { queueId } = await params
    const body = await request.json()

    const parsed = VALID_STATUSES.safeParse(body.status)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }
    const status = parsed.data

    // Role-based transition guard
    const allowed = ROLE_ALLOWED_TRANSITIONS[session.role] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "Forbidden: role cannot set this status" }, { status: 403 })
    }

    // Branch ownership guard — non-ADMIN may only update entries in their branch
    if (session.role !== "ADMIN") {
      const existing = await queueRepository.findById(queueId)
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (existing.branchId !== session.branchId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const entry = await queueService.updateStatus(queueId, status, session.userId)
    return NextResponse.json({ entry })
  } catch {
    return NextResponse.json({ error: "Failed to update queue status" }, { status: 500 })
  }
}
