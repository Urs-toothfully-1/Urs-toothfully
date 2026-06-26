import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { paymentService } from "@/server/services/payment.service"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ paymentId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(["ADMIN", "RECEPTIONIST", "DOCTOR"])
    const { paymentId } = await params
    const payment = await paymentRepository.findById(paymentId)
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ payment })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole(["ADMIN"])
    const { paymentId } = await params
    const body = await request.json()
    if (!body.reason) return NextResponse.json({ error: "Reason required" }, { status: 400 })
    await paymentService.softDelete(paymentId, session.userId, body.reason)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
