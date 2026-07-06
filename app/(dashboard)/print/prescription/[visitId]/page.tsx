import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import { PrintButtons } from "@/components/print/PrintButtons"
import { ShareActions } from "@/components/share/ShareActions"
import type { PrescriptionData } from "@/lib/prescription-types"

export const metadata: Metadata = { title: "Print Prescription" }

type Props = { params: Promise<{ visitId: string }> }

// Layout mirrors the frozen pad template public/prescription.html:
// hader1.jpg → grey left column (doctor, reg no, chief complaint, past illness,
// medical history, diagnosis) + white right column (patient, on examination, Rx)
// → fotter2.jpg. A4 landscape.
const GREY = "#EBECEE"
const LINE = "#999999"

function BlankLines({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${LINE}`, minHeight: 26 }} />
      ))}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-bold text-[13px] mt-4 mb-1 tracking-wide">{children}</p>
}

export default async function PrintPrescriptionPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { visitId } = await params

  const visit = await prisma.patientVisit.findUnique({
    where: { id: visitId },
    include: {
      patient: {
        select: {
          patientId: true, fullName: true, dateOfBirth: true, gender: true,
          mobile: true, email: true, reasonForVisit: true,
        },
      },
      doctor: { select: { name: true, doctorRegNo: true, doctorQualification: true } },
      branch: { select: { name: true, address: true, phone: true } },
    },
  })

  if (!visit) notFound()

  const record = await prisma.prescriptionRecord.findFirst({
    where: { visitId },
    orderBy: { createdAt: "desc" },
  })
  const rx = (record?.prescriptionData ?? null) as unknown as PrescriptionData | null

  if (record) {
    await prisma.prescriptionRecord
      .update({ where: { id: record.id }, data: { printedAt: new Date() } })
      .catch(() => {})
  } else {
    // PRINT_ONLY fallback for visits without an estimate yet (audit trail)
    await prisma.prescriptionRecord.create({
      data: {
        patientId: visit.patientId,
        visitId,
        doctorId: visit.doctorId ?? session.userId,
        mode: "PRINT_ONLY",
        printedAt: new Date(),
      },
    }).catch(() => {})
  }

  const age = Math.floor(
    (new Date().getTime() - new Date(visit.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  )
  // Chief complaint comes from the doctor's written entry, not receptionist's intake note
  const chiefComplaint = rx?.chiefComplaint ?? ""
  const medicalAlerts = rx?.medicalAlerts ?? []
  const onExamination = rx?.onExamination ?? []
  const medicines = rx?.medicines ?? []

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 6mm; size: A4; }
          html, body {
            margin: 0 !important; padding: 0 !important;
            height: auto !important; overflow: visible !important; background: white !important;
          }
          aside, header, nav { display: none !important; }
          * { overflow: visible !important; height: auto !important; max-height: none !important; }
          .print-doc {
            max-width: 100% !important; padding: 0 !important; margin: 0 auto !important;
            /* fill the printable area (A4 297mm − 2×6mm margins) so the footer pins to the page bottom */
            min-height: 284mm !important;
            display: flex; flex-direction: column;
          }
          .print-body { flex: 1; }
          .print-footer { margin-top: auto; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; font-size: 15px; color: #000; }
      `}</style>

      <PrintButtons />

      {record && (
        <div className="no-print fixed top-4 left-4 z-50">
          <ShareActions
            type="prescription"
            id={record.id}
            patientName={visit.patient.fullName}
            patientMobile={visit.patient.mobile}
            patientEmail={visit.patient.email}
            docNo={`RX-${visit.patient.patientId}`}
            branchName={visit.branch.name}
          />
        </div>
      )}

      {/* Prescription document — pad template (public/prescription.html), A4 portrait */}
      <div className="print-doc mx-auto" style={{ maxWidth: 780 }}>
        {/* Header strip (letterhead) */}
        <img src="/hader1.jpg" alt="Ur's Toothfully" className="w-full block" style={{ backgroundColor: GREY }} />

        <div className="print-body flex items-stretch">
          {/* ── Left grey column ─────────────────────────────── */}
          <div style={{ width: "38%", backgroundColor: GREY }} className="px-6 py-4">
            <div
              className="text-[17px] font-medium"
              style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 2, marginBottom: 12 }}
            >
              {visit.doctor ? `Dr. ${visit.doctor.name.replace(/^Dr\.?\s*/i, "")}` : "Dr."}
            </div>
            <div
              className="text-[15px]"
              style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 2 }}
            >
              REGISTRATION NUMBER: {visit.doctor?.doctorRegNo ?? ""}
            </div>

            <SectionLabel>CHIEF COMPLAINT</SectionLabel>
            {chiefComplaint ? (
              <p className="text-[14px] whitespace-pre-line min-h-[80px]">{chiefComplaint}</p>
            ) : (
              <div className="min-h-[80px]" />
            )}

            <SectionLabel>MEDICAL HISTORY</SectionLabel>
            {medicalAlerts.length > 0 ? (
              <ul className="text-[14px] min-h-[110px] space-y-0.5">
                {medicalAlerts.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            ) : (
              <div className="min-h-[110px]" />
            )}

            <SectionLabel>DIAGNOSIS</SectionLabel>
            <div className="min-h-[90px]" />
          </div>

          {/* ── Right white column ───────────────────────────── */}
          <div style={{ width: "62%" }} className="px-8 py-4">
            {/* Patient name */}
            <div className="flex items-end gap-2 text-[15px]">
              <strong className="whitespace-nowrap">PATIENT NAME :</strong>
              <span
                className="flex-1 text-[18px]"
                style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 1 }}
              >
                {visit.patient.fullName}
              </span>
            </div>

            {/* Age / Sex / Date */}
            <div className="flex items-end gap-2 mt-4 text-[15px]">
              <span>AGE:</span>
              <span style={{ borderBottom: `1px solid ${LINE}`, minWidth: 70, textAlign: "center" }} className="text-[17px]">
                {age}
              </span>
              <span className="ml-3">SEX:</span>
              <span style={{ borderBottom: `1px solid ${LINE}`, minWidth: 70, textAlign: "center" }} className="text-[17px]">
                {visit.patient.gender.charAt(0)}
              </span>
              <span className="ml-3">DATE:</span>
              <span style={{ borderBottom: `1px solid ${LINE}`, minWidth: 160, textAlign: "center" }} className="text-[17px]">
                {formatDate(new Date())}
              </span>
            </div>

            {/* On examination — doctor's clinical findings */}
            <p className="font-bold text-[13px] mt-6 mb-1 tracking-wide">ON EXAMINATION</p>
            {onExamination.length > 0 ? (
              <ul className="text-[14px] space-y-1 min-h-[110px]">
                {onExamination.map((f, i) => (
                  <li key={i}>
                    •{" "}
                    {f.toothNumbers
                      ? <><strong>{f.toothNumbers.includes(",") ? "Teeth" : "Tooth"} {f.toothNumbers.split(",").join(", ")}:</strong>{" "}</>
                      : null}
                    {f.finding}
                  </li>
                ))}
              </ul>
            ) : (
              <BlankLines count={4} />
            )}

            {/* Rx */}
            <p className="font-bold text-[20px] mt-6 mb-2">RX</p>
            {medicines.length > 0 ? (
              <table className="w-full text-[14px] mb-3" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    {["Medicine", "Dosage", "Frequency", "Duration"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-1 text-[12px] font-bold"
                        style={{ borderBottom: `1px solid ${LINE}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((m, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-2" style={{ borderBottom: "1px solid #DDDDDD" }}>
                        <span className="font-medium">{m.name}</span>
                        {m.instructions && <span className="text-[12px]"> — {m.instructions}</span>}
                      </td>
                      <td className="py-1.5 pr-2" style={{ borderBottom: "1px solid #DDDDDD" }}>{m.dosage}</td>
                      <td className="py-1.5 pr-2" style={{ borderBottom: "1px solid #DDDDDD" }}>{m.frequency}</td>
                      <td className="py-1.5" style={{ borderBottom: "1px solid #DDDDDD" }}>{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <BlankLines count={7} />
            )}

            {/* Advice */}
            {rx?.advice ? (
              <div className="mt-3">
                <p className="font-bold text-[13px] mb-1 tracking-wide">ADVICE</p>
                <p className="text-[14px] whitespace-pre-line">{rx.advice}</p>
              </div>
            ) : null}

            {/* Next visit + signature */}
            <div className="flex items-end justify-between mt-6">
              <div className="flex items-end gap-2 text-[15px]">
                <span className="whitespace-nowrap">NEXT VISIT:</span>
                <span style={{ borderBottom: `1px solid ${LINE}`, minWidth: 150, textAlign: "center" }} className="text-[16px]">
                  {rx?.followUpDate ? formatDate(new Date(rx.followUpDate)) : " "}
                </span>
              </div>
              <div className="text-center">
                <div style={{ borderBottom: "1px solid #666", width: 180, height: 34 }} />
                <p className="text-[12px] mt-1">
                  {visit.doctor ? `Dr. ${visit.doctor.name.replace(/^Dr\.?\s*/i, "")}` : "Doctor"}
                  {visit.doctor?.doctorRegNo ? ` · Reg: ${visit.doctor.doctorRegNo}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer strip (branches + QR codes) — pinned to page bottom in print */}
        <img src="/fotter2.jpg" alt="Branches" className="print-footer w-full block" />
      </div>
    </>
  )
}
