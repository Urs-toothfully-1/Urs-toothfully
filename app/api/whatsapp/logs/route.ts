import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { whatsappMessageRepository } from "@/server/repositories/whatsapp-message.repository"
import type { WhatsAppMessageStatus } from "@prisma/client"

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "RECEPTIONIST"])
    const sp = request.nextUrl.searchParams

    const filters = {
      status: (sp.get("status") as WhatsAppMessageStatus) ?? undefined,
      search: sp.get("search") ?? undefined,
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(`${sp.get("to")}T23:59:59.999`) : undefined,
    }

    if (sp.get("format") === "csv") {
      const rows = await whatsappMessageRepository.findAllForExport(filters)
      const header = [
        "Date", "Patient", "Patient ID", "Phone", "Template", "Variables", "Status",
        "Message ID", "Sent At", "Delivered At", "Read At", "Failure Reason", "Branch",
      ]
      const lines = [header.join(",")]
      for (const m of rows) {
        lines.push([
          csvEscape(m.createdAt.toISOString()),
          csvEscape(m.patient?.fullName ?? ""),
          csvEscape(m.patient?.patientId ?? ""),
          csvEscape(m.toPhone),
          csvEscape(m.templateName),
          csvEscape(m.variables ? JSON.stringify(m.variables) : ""),
          csvEscape(m.status),
          csvEscape(m.metaMessageId ?? ""),
          csvEscape(m.sentAt?.toISOString() ?? ""),
          csvEscape(m.deliveredAt?.toISOString() ?? ""),
          csvEscape(m.readAt?.toISOString() ?? ""),
          csvEscape(m.failureReason ?? ""),
          csvEscape(m.branch?.name ?? ""),
        ].join(","))
      }
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="whatsapp-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    const result = await whatsappMessageRepository.findMany({
      ...filters,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Math.min(Number(sp.get("pageSize")), 100) : 50,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
