import { NextRequest, NextResponse } from "next/server"
import { appointmentService } from "@/server/services/appointment.service"
import { digestService } from "@/server/services/whatsapp/digest.service"
import { whatsappQueueService } from "@/server/services/whatsapp/queue.service"

export const maxDuration = 60

/**
 * Daily automation endpoint — invoked by Vercel Cron (see vercel.json).
 * Sends tomorrow's appointment reminders, queues the admin daily digest,
 * then drains the WhatsApp queue.
 *
 * Auth: Authorization: Bearer <CRON_SECRET or WHATSAPP_CRON_SECRET>.
 * Vercel Cron sends CRON_SECRET automatically when the env var is set.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.WHATSAPP_CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 })
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: Record<string, unknown> = {}
  try {
    results.reminders = await appointmentService.sendReminders()
  } catch (err) {
    results.reminders = { error: err instanceof Error ? err.message : "failed" }
  }
  try {
    results.digest = await digestService.sendDailyDigest()
  } catch (err) {
    results.digest = { error: err instanceof Error ? err.message : "failed" }
  }
  try {
    results.queue = await whatsappQueueService.processQueue()
  } catch (err) {
    results.queue = { error: err instanceof Error ? err.message : "failed" }
  }

  return NextResponse.json({ ok: true, ...results })
}
