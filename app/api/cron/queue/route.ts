import { NextRequest, NextResponse } from "next/server"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"

/**
 * Drains the WhatsApp queue (sends queued messages, retries failed ones that are
 * due). Called every 2 minutes by the Railway scheduler (lib/scheduler.ts).
 * Lives under /api/cron so proxy.ts lets it through without a login session;
 * the bearer secret is the auth, same as /api/cron/daily.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.WHATSAPP_CRON_SECRET
  if (!secret) return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await whatsappQueueService.processQueue())
}
