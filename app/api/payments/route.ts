import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { paymentService } from "@/server/services/payment.service"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { validatePaymentInput } from "@/lib/payment-guard"
import { Decimal } from "@prisma/client/runtime/library"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "DOCTOR", "RECEPTIONIST"])
    const patientId = request.nextUrl.searchParams.get("patientId")
    if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })
    const payments = await paymentRepository.findByPatient(patientId)
    return NextResponse.json({ payments })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "RECEPTIONIST"])
    const body = await request.json()

    validatePaymentInput(body, session.role)

    const { payment, receipt } = await paymentService.create(body, session.userId)
    return NextResponse.json({ payment, receipt }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to record payment"
    const status = ["Unauthorized", "UNAUTHORIZED", "FORBIDDEN"].includes(msg) ? 401 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
