import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { patientRepository } from "@/server/repositories/patient.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { userRepository } from "@/server/repositories/user.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { AddToQueueDialog } from "@/components/queue/AddToQueueDialog"
import { queueRepository } from "@/server/repositories/queue.repository"
import { prisma } from "@/lib/prisma"
import { getPatientBalance } from "@/server/services/patient-summary.service"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MapPin, Phone, Mail, Calendar, Tag, User,
  AlertCircle, CheckCircle2, ClipboardList, FileText, FolderOpen, Receipt as ReceiptIcon,
} from "lucide-react"

type Props = { params: Promise<{ patientId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { patientId } = await params
  const patient = await patientRepository.findById(patientId)
  return { title: patient ? `${patient.fullName} — Overview` : "Patient" }
}

export default async function PatientOverviewPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params

  const [patient, visits, consultationPayment, billingEstimates, recentDocs] = await Promise.all([
    patientRepository.findById(patientId),
    visitRepository.findByPatient(patientId),
    prisma.payment.findFirst({
      where: { patientId, paymentType: "CONSULTATION", isDeleted: false },
      select: { id: true },
    }),
    prisma.estimate.findMany({
      where: { patientId, isDeleted: false, status: "ACTIVE" },
      select: {
        total: true,
        payments: {
          where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } },
          select: { amount: true },
        },
      },
    }),
    Promise.all([
      prisma.estimate.findMany({
        where: { patientId, isDeleted: false },
        select: { id: true, estimateNo: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.receipt.findMany({
        where: { patientId },
        select: { id: true, receiptNo: true, issuedAt: true },
        orderBy: { issuedAt: "desc" },
        take: 3,
      }),
      prisma.prescriptionRecord.findMany({
        where: { patientId, mode: { not: "PRINT_ONLY" } },
        select: { id: true, visitId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]),
  ])

  if (!patient) notFound()

  const hasPaidConsultation = !!consultationPayment
  // Same source as the header above, so the two can never disagree.
  const { estimated: totalEstimated, paid: totalPaid, outstanding } = await getPatientBalance(patientId)
  const [docEstimates, docReceipts, docPrescriptions] = recentDocs
  const documents = [
    ...docEstimates.map((e) => ({
      key: `est-${e.id}`, label: "Estimate", docNo: e.estimateNo, date: e.createdAt,
      href: `/doctor/estimate/${e.id}`, printHref: `/print/estimate/${e.id}`, kind: "estimate" as const,
    })),
    ...docReceipts.map((r) => ({
      key: `rcp-${r.id}`, label: "Receipt", docNo: r.receiptNo, date: r.issuedAt,
      href: `/print/receipt/${r.id}`, printHref: `/print/receipt/${r.id}`, kind: "receipt" as const,
    })),
    ...docPrescriptions.map((p) => ({
      key: `rx-${p.id}`, label: "Prescription", docNo: `RX-${patient!.patientId}`, date: p.createdAt,
      href: `/doctor/prescription/${p.id}`, printHref: `/print/prescription/${p.visitId}`, kind: "prescription" as const,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6)

  // Fetch Add to Queue data only for reception/admin
  const canAddToQueue = session.role === "RECEPTIONIST" || session.role === "ADMIN"
  const [doctors, assignmentMode, activeQueueEntry] = canAddToQueue
    ? await Promise.all([
        userRepository.findAllActiveDoctors(),
        settingsRepository.get("queue_assignment_mode", session.branchId),
        queueRepository.findActiveForPatient(patientId, session.branchId),
      ])
    : [[], null, null]

  const recentVisits = visits.slice(0, 5)

  const detailRows = [
    { icon: Phone, label: "Mobile", value: patient.mobile },
    { icon: Mail, label: "Email", value: patient.email ?? "—" },
    { icon: MapPin, label: "Address", value: patient.address ?? "—" },
    { icon: Tag, label: "Lead Source", value: patient.leadSource ?? "—" },
    { icon: User, label: "Reference", value: patient.referenceName ?? "—" },
    {
      icon: Calendar,
      label: "Registered",
      value: `${patient.registrationBranch.name} Branch · ${formatDate(patient.createdAt)}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Patient Details */}
      <Card className="lg:col-span-1 border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
            Patient Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detailRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3">
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_COLORS.borderDivider }} />
              <div>
                <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{label}</p>
                <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{value}</p>
              </div>
            </div>
          ))}
          {patient.reasonForVisit && (
            <div className="pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <p className="text-xs mb-1" style={{ color: BRAND_COLORS.borderDivider }}>Chief Complaint</p>
              <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{patient.reasonForVisit}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right column */}
      <div className="lg:col-span-2 space-y-4">
        {/* ── STEP 1: Consultation fee ─────────────────────────────── */}
        {!hasPaidConsultation ? (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-bold text-red-700">Step 1 — Collect Consultation Fee</p>
                  <p className="text-xs mt-0.5 text-red-600">
                    Consultation fee must be collected before the patient is added to the doctor queue.
                  </p>
                </div>
              </div>
              {canAddToQueue && (
                <Link
                  href={`/reception/collect-payment?patientId=${patient.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: "#DC2626" }}
                >
                  Collect Fee
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5"
            style={{ borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }}
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Consultation Fee Paid</span>
          </div>
        )}

        {/* ── STEP 2: Add to Queue (only available after fee is paid) ── */}
        {canAddToQueue && (
          <Card
            className={
              activeQueueEntry
                ? "border-amber-400 bg-amber-50"
                : hasPaidConsultation
                  ? "border-[#0077BE] bg-[#0077BE]/5"
                  : "border-[#E0E3E5] bg-[#F2F4F6] opacity-60"
            }
          >
            <CardContent className="p-4 flex items-center justify-between gap-4">
              {activeQueueEntry ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">
                      Already in the queue
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                      Token #{activeQueueEntry.tokenNumber} · Status: {activeQueueEntry.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Link
                    href="/reception"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border border-amber-400 text-amber-700 bg-white"
                  >
                    View Queue
                  </Link>
                </>
              ) : hasPaidConsultation ? (
                <>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                      Step 2 — Add to Doctor Queue
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                      Consultation fee received. {patient.fullName} is ready to see a doctor.
                    </p>
                  </div>
                  <AddToQueueDialog
                    patientId={patient.id}
                    patientName={patient.fullName}
                    branchName={patient.registrationBranch.name}
                    doctors={doctors as any}
                    assignmentMode={assignmentMode ?? "SPECIFIC_DOCTOR"}
                  />
                </>
              ) : (
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>
                    Step 2 — Add to Doctor Queue
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                    Collect the consultation fee first to unlock this step.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Next Steps for new patients */}
        {visits.length === 0 && !hasPaidConsultation && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-amber-800">New Patient — Next Steps</p>
              <ol className="mt-2 space-y-1 text-sm list-decimal list-inside text-amber-700">
                <li>Collect Consultation Fee (₹1,000)</li>
                <li>Add to Doctor Queue</li>
                <li>Doctor consultation → estimate &amp; prescription</li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Billing summary — shown once the patient has an active estimate */}
        {billingEstimates.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Estimated", value: formatCurrency(totalEstimated), color: BRAND_COLORS.primaryTeal },
              { label: "Paid", value: formatCurrency(totalPaid), color: BRAND_COLORS.secondaryGreen },
              { label: "Outstanding Balance", value: formatCurrency(outstanding), color: outstanding > 0 ? "#C2410C" : BRAND_COLORS.secondaryGreen },
            ].map((s) => (
              <Card key={s.label} className="border-[#E0E3E5] bg-white">
                <CardContent className="p-3 text-center">
                  <p className="text-xl font-semibold tracking-tight" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Visit summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Visits", value: visits.length.toString() },
            { label: "Branches", value: new Set(visits.map((v: any) => v.branchId)).size.toString() },
            { label: "Last Visit", value: visits[0] ? formatDate(visits[0].visitDate) : "—" },
          ].map((s) => (
            <Card key={s.label} className="border-[#E0E3E5] bg-white">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.primaryTeal }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documents — estimates, receipts, prescriptions at a glance */}
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                <FolderOpen className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                Documents
              </CardTitle>
              <Link href={`/patients/${patientId}/documents`} className="text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>
                No documents yet — estimates and prescriptions will appear here.
              </p>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => {
                  const Icon = doc.kind === "estimate" ? FileText : doc.kind === "receipt" ? ReceiptIcon : ClipboardList
                  const iconColor = doc.kind === "estimate" ? BRAND_COLORS.primaryTeal : doc.kind === "receipt" ? BRAND_COLORS.secondaryGreen : "#7C3AED"
                  return (
                    <div
                      key={doc.key}
                      className="flex items-center justify-between py-1.5 border-b last:border-0"
                      style={{ borderColor: BRAND_COLORS.lightBackground }}
                    >
                      <Link href={doc.href} className="flex items-center gap-2.5 group">
                        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: iconColor }} />
                        <span className="text-sm font-medium group-hover:underline" style={{ color: BRAND_COLORS.bodyText }}>
                          {doc.label}
                        </span>
                        <span className="font-mono text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                          {doc.docNo}
                        </span>
                      </Link>
                      <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {formatDate(doc.date)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Visits */}
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                Recent Visits
              </CardTitle>
              {visits.length > 5 && (
                <Link href={`/patients/${patientId}/visits`} className="text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                  View all →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>
                No visits yet
              </p>
            ) : (
              <div className="space-y-2">
                {recentVisits.map((visit: any) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: BRAND_COLORS.lightBackground }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>{visit.visitNo}</p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {visit.visitType?.replace(/_/g, " ")} · {visit.branch?.name ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{formatDate(visit.visitDate)}</p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: visit.status === "COMPLETED" ? "#DCFCE7" : visit.status === "IN_PROGRESS" ? "#FEF9C3" : "#F3F4F6",
                          color: visit.status === "COMPLETED" ? "#166534" : visit.status === "IN_PROGRESS" ? "#854D0E" : BRAND_COLORS.borderDivider,
                        }}
                      >
                        {visit.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
