import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { prescriptionService } from "@/server/services/prescription.service"
import { PrescriptionEditor } from "@/components/prescriptions/PrescriptionEditor"
import { ShareActions } from "@/components/share/ShareActions"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, ChevronRight, ClipboardList, Printer } from "lucide-react"
import type { PrescriptionData } from "@/lib/prescription-types"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Prescription" }

type Props = { params: Promise<{ prescriptionId: string }> }

export default async function PrescriptionPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { prescriptionId } = await params
  const prescription = await prescriptionService.getById(prescriptionId)
  if (!prescription) notFound()

  const data = (prescription.prescriptionData ?? {}) as unknown as PrescriptionData
  const canEdit = session.role === "ADMIN" || session.role === "DOCTOR"

  const initialTemplates = canEdit
    ? await prisma.examinationTemplate
        .findMany({
          where: { doctorId: session.userId },
          orderBy: { name: "asc" },
          select: { id: true, name: true, finding: true },
        })
        .catch(() => [])
    : []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href={`/patients/${prescription.patientId}`} style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          {prescription.patient.fullName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Prescription</span>
      </nav>

      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Prescription — {prescription.patient.patientId}
            </CardTitle>
            <div className="flex items-center gap-4">
              <Link
                href={`/print/prescription/${prescription.visitId}`}
                target="_blank"
                className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: BRAND_COLORS.primaryTeal }}
              >
                <Printer className="h-4 w-4" />
                Print
              </Link>
              <ShareActions
                type="prescription"
                id={prescription.id}
                patientName={prescription.patient.fullName}
                patientMobile={prescription.patient.mobile}
                patientEmail={prescription.patient.email}
                docNo={`RX-${prescription.patient.patientId}`}
                branchName={data.branchName}
                compact
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
            <span>Date: {formatDate(prescription.createdAt)}</span>
            <span>Doctor: {data.doctorName ?? prescription.doctor.name}</span>
            {data.branchName && <span>Branch: {data.branchName}</span>}
            {data.estimateNo && <span>Estimate: {data.estimateNo}</span>}
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {/* Patient snapshot */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Patient</p>
              <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>{data.patient?.name}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Age / Sex</p>
              <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                {data.patient?.age} yrs / {data.patient?.gender?.charAt(0)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Mobile</p>
              <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>{data.patient?.mobile}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>ID</p>
              <p className="font-mono text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>{data.patient?.patientId}</p>
            </div>
          </div>

          {/* Medical alerts from dental history */}
          {data.medicalAlerts?.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                MEDICAL ALERTS
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {data.medicalAlerts.map((alert, i) => (
                  <li key={i} className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Treatment plan (no prices) */}
          {data.treatments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: BRAND_COLORS.borderDivider }}>
                PLANNED TREATMENT
              </p>
              <ul className="space-y-1.5">
                {data.treatments.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
                    />
                    {t.treatmentName}
                    {t.toothNumber && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-mono"
                        style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
                      >
                        {t.toothNumber.includes(",") ? "Teeth" : "Tooth"} {t.toothNumber.split(",").join(", ")}
                      </span>
                    )}
                    {t.quantity > 1 && (
                      <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>× {t.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Editable section */}
          <PrescriptionEditor prescriptionId={prescription.id} data={data} canEdit={canEdit} initialTemplates={initialTemplates} />

          {!canEdit && (
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              Medicines and advice can only be edited by the doctor.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
