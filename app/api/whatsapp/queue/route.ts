import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"
import type { WhatsAppMessageStatus } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "RECEPTIONIST"])
    const sp = request.nextUrl.searchParams
    const result = await whatsappMessageRepository.findMany({
      status: (sp.get("status") as WhatsAppMessageStatus) ?? undefined,
      search: sp.get("search") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Math.min(Number(sp.get("pageSize")), 100) : 50,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

/**
 * Drains the queue. Called by staff from the UI, and can also be invoked by an
 * external cron with the WHATSAPP_CRON_SECRET bearer token (for scheduled
 * retries when nobody is logged in).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.WHATSAPP_CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const viaCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!viaCron) {
    try {
      await requireRole(["ADMIN", "RECEPTIONIST"])
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const result = await whatsappQueueService.processQueue()
  return NextResponse.json(result)
}
