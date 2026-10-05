import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toCsv } from "@/lib/csv"
import { owedAmount, OWED_SELECT } from "@/lib/estimate-owed"
import { createAuditLog } from "@/lib/audit"
import { UNKNOWN_DOB } from "@/lib/patient-dob"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "")

/** Every (non-deleted) patient with contact, referral and money summary — admin only. */
export async function GET() {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const patients = await prisma.patient.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, patientId: true, fullName: true, mobile: true, email: true, gender: true, dateOfBirth: true,
      address: true, leadSource: true, referenceName: true, referralCode: true, reasonForVisit: true, createdAt: true,
      registrationBranch: { select: { name: true } },
      referredBy: { select: { createdAt: true, referrer: { select: { patientId: true, fullName: true } } } },
      whatsappConsent: { select: { consented: true, revokedAt: true } },
      _count: { select: { visits: true, referralsMade: true } },
      visits: { orderBy: { visitDate: "desc" }, take: 1, select: { visitDate: true } },
    },
  })

  // Money in two grouped queries instead of one per patient.
  const [estimates, payments] = await Promise.all([
    prisma.estimate.findMany({
      where: { isDeleted: false, status: "ACTIVE" },
      select: { patientId: true, ...OWED_SELECT, payments: { where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } }, select: { amount: true } } },
    }),
    prisma.payment.groupBy({ by: ["patientId"], where: { isDeleted: false }, _sum: { amount: true } }),
  ])
  const billed = new Map<string, number>()
  const due = new Map<string, number>()
  for (const e of estimates) {
    const owed = owedAmount(e)
    const paid = e.payments.reduce((s, p) => s + Number(p.amount), 0)
    billed.set(e.patientId, (billed.get(e.patientId) ?? 0) + owed)
    due.set(e.patientId, (due.get(e.patientId) ?? 0) + Math.max(0, owed - paid))
  }
  const collected = new Map(payments.map((p) => [p.patientId, Number(p._sum.amount ?? 0)]))

  const header = [
    "Patient ID", "Name", "Mobile", "Email", "Gender", "Date of Birth", "Address", "Registered Branch", "Registered On",
    "Lead Source", "Reference Name", "Reason for Visit", "Referral Code", "Referred By (ID)", "Referred By (Name)", "Referred On",
    "Patients Referred", "Visits", "Last Visit", "Billed (₹)", "Total Collected (₹)", "Balance Due (₹)", "WhatsApp Opt-in",
  ]
  const rows = patients.map((p) => [
    p.patientId, p.fullName, p.mobile, p.email ?? "", p.gender,
    p.dateOfBirth.getTime() === UNKNOWN_DOB.getTime() ? "" : d(p.dateOfBirth),
    p.address ?? "", p.registrationBranch.name, d(p.createdAt),
    p.leadSource ?? "", p.referenceName ?? "", p.reasonForVisit ?? "", p.referralCode ?? "",
    p.referredBy?.referrer.patientId ?? "", p.referredBy?.referrer.fullName ?? "", d(p.referredBy?.createdAt),
    p._count.referralsMade, p._count.visits, d(p.visits[0]?.visitDate),
    (billed.get(p.id) ?? 0).toFixed(2), (collected.get(p.id) ?? 0).toFixed(2), (due.get(p.id) ?? 0).toFixed(2),
    p.whatsappConsent?.consented && !p.whatsappConsent.revokedAt ? "Yes" : "No",
  ])

  await createAuditLog({ entityType: "Patient", entityId: "export", action: "EXPORT", changedById: session.userId, newValues: { rows: rows.length } }).catch(() => null)

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patients-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
