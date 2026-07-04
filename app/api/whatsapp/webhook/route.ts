import { NextRequest, NextResponse } from "next/server"
import { webhookService } from "@/server/services/whatsapp/webhook.service"

/**
 * Meta WhatsApp Cloud API webhook (public — listed in proxy.ts PUBLIC_PATHS).
 * GET  = subscription verification handshake
 * POST = message status events (sent/delivered/read/failed)
 */

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const challenge = await webhookService.handleVerification(
    sp.get("hub.mode"),
    sp.get("hub.verify_token"),
    sp.get("hub.challenge")
  )
  if (!challenge) return NextResponse.json({ error: "Verification failed" }, { status: 403 })
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const signatureOk = await webhookService.verifySignature(rawBody, request.headers.get("x-hub-signature-256"))
  if (!signatureOk) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  await webhookService.processEvent(payload)
  // Always 200 — Meta retries aggressively on non-2xx
  return NextResponse.json({ received: true })
}
