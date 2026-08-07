import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 10

/**
 * Daily no-op query, invoked by Vercel Cron (see vercel.json).
 *
 * Supabase's free tier pauses a project after 7 days with zero database
 * activity, which would otherwise need a manual restart from the dashboard.
 * A trivial daily query is enough to keep it counted as active — the clinic
 * being used daily already prevents this in practice, but a quiet week
 * (branch closure, holiday) could otherwise trigger it unexpectedly.
 *
 * Auth: same Authorization: Bearer <CRON_SECRET> pattern as /api/cron/daily.
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

  try {
    const branches = await prisma.branch.count()
    return NextResponse.json({ ok: true, branches, at: new Date().toISOString() })
  } catch (err) {
    console.error("[cron/keepalive] failed:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ping failed" }, { status: 500 })
  }
}
