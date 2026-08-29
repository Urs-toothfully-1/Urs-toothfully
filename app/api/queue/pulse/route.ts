import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { queueRepository } from "@/server/repositories/queue.repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 10

/**
 * Lightweight change-token for the live queue, polled by <AutoRefresh />.
 *
 * Returns a short signature of the branch's current queue (see
 * queueRepository.pulse). The client re-renders the full dashboard only when
 * this value changes, so most polls are a single tiny query instead of a full
 * server-component re-render + every dashboard query. This is the change that
 * brought Vercel Function invocations back under control.
 *
 * Branch-scoped for every role: a doctor's own queue and the unclaimed pool
 * both live in the same branch, so a branch-level token covers all dashboards.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const v = await queueRepository.pulse(session.branchId)
    return NextResponse.json(
      { v },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
