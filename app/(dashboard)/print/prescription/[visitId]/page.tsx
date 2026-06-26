import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { PrintButtons } from "@/components/print/PrintButtons"

export const metadata: Metadata = { title: "Print Prescription" }

type Props = { params: Promise<{ visitId: string }> }

export default async function PrintPrescriptionPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { visitId } = await params

  const visit = await prisma.patientVisit.findUnique({
    where: { id: visitId },
    include: {
      patient: { select: { patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true } },
      doctor: { select: { name: true, doctorRegNo: true, doctorQualification: true } },
      branch: { select: { name: true, address: true, phone: true } },
    },
  })

  if (!visit) notFound()

  // Create PrescriptionRecord for PRINT_ONLY mode (audit trail)
  await prisma.prescriptionRecord.create({
    data: {
      patientId: visit.patientId,
      visitId,
      doctorId: visit.doctorId ?? session.userId,
      mode: "PRINT_ONLY",
      printedAt: new Date(),
    },
  }).catch(() => {}) // Non-fatal — record may already exist

  const age = Math.floor(
    (new Date().getTime() - new Date(visit.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )

  const MEDICINE_ROWS = 8

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 8mm; size: A4; }
          html, body {
            margin: 0 !important; padding: 0 !important;
            height: auto !important; overflow: visible !important; background: white !important;
          }
          aside, header, nav { display: none !important; }
          * { overflow: visible !important; height: auto !important; max-height: none !important; }
          .print-doc { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
        .rx-line { border-bottom: 1px solid #CCCCCC; min-height: 28px; }
      `}</style>

      <PrintButtons />

      {/* Prescription document */}
      <div className="print-doc max-w-[600px] mx-auto p-4">
        {/* Header */}
        <img src="/Header.jpg" alt="Header" className="w-full mb-3" />

        {/* Patient + Date bar */}
        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div>
            <div className="flex gap-1 mb-1">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Patient:</span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{visit.patient.fullName}</strong>
            </div>
            <div className="flex gap-1 mb-1">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Age/Sex:</span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{age} yrs / {visit.patient.gender.charAt(0)}</span>
            </div>
            <div className="flex gap-1">
              <span style={{ color: BRAND_COLORS.borderDivider }}>ID:</span>
              <span className="font-mono text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                {visit.patient.patientId}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Date: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{formatDate(new Date())}</strong>
            </div>
            <div className="mb-1">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Visit: </span>
              <span className="font-mono text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                {visit.visitNo}
              </span>
            </div>
            {visit.doctor && (
              <div className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                {visit.doctor.name}
              </div>
            )}
          </div>
        </div>

        <div className="border-b-2 mb-3" style={{ borderColor: BRAND_COLORS.primaryTeal }} />

        {/* Rx Symbol */}
        <div className="flex items-start gap-2 mb-2">
          <span className="text-3xl font-bold" style={{ color: BRAND_COLORS.primaryTeal, lineHeight: 1 }}>℞</span>
          <div className="flex-1">
            {/* Medicine rows */}
            <div className="space-y-1 mb-4">
              {Array.from({ length: MEDICINE_ROWS }, (_, i) => (
                <div key={i} className="rx-line" />
              ))}
            </div>
          </div>
        </div>

        {/* Advice section */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-1" style={{ color: BRAND_COLORS.borderDivider }}>
            ADVICE / INSTRUCTIONS:
          </p>
          <div className="space-y-1">
            {[1, 2, 3].map((i) => <div key={i} className="rx-line" />)}
          </div>
        </div>

        {/* Next visit */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span style={{ color: BRAND_COLORS.borderDivider }}>Next Visit:</span>
          <div className="rx-line flex-1" />
        </div>

        {/* Signature */}
        <div className="flex justify-end mt-6">
          <div className="text-center">
            <div className="border-b border-gray-400 w-32 mb-1 h-8" />
            <p className="text-xs" style={{ color: BRAND_COLORS.bodyText }}>
              {visit.doctor?.name ?? "Doctor"}
            </p>
            {visit.doctor?.doctorRegNo && (
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                Reg: {visit.doctor.doctorRegNo}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4">
          <img src="/fotter-1.jpg" alt="Footer" className="w-full" />
        </div>
      </div>
    </>
  )
}
