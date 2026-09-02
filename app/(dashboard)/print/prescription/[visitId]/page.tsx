import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatDate } from "@/lib/utils"
import { formatAge } from "@/lib/patient-dob"
import { toothLabel } from "@/lib/teeth"
import { PrintButtons } from "@/components/print/PrintButtons"
import { ShareActions } from "@/components/share/ShareActions"
import type { PrescriptionData } from "@/lib/prescription-types"

export const metadata: Metadata = { title: "Print Prescription" }

type Props = { params: Promise<{ visitId: string }>; searchParams: Promise<{ mode?: string }> }

function fmtNoteDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// Layout mirrors the frozen pad template public/prescription.html:
// hader1.jpg → grey left column (doctor, reg no, chief complaint, past illness,
// medical history, diagnosis) + white right column (patient, on examination, Rx)
// → fotter2.jpg. A4 landscape.
const GREY = "#EBECEE"
const LINE = "#999999"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-bold text-[13px] mt-4 mb-1 tracking-wide">{children}</p>
}

export default async function PrintPrescriptionPage({ params, searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { mode } = await searchParams
  const updatesOnly = mode === "updates"

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
      doctor: { select: { name: true, doctorRegNo: true, doctorQualification: true, signatureData: true } },
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

  // Version = chronological ordinal among this patient's prescriptions (v1, v2, …)
  const rxVersion = record
    ? await prisma.prescriptionRecord.count({ where: { patientId: visit.patientId, createdAt: { lte: record.createdAt } } })
    : 1

  // Blank rather than a nonsense number when the DOB is the online-booking sentinel
  const age = formatAge(visit.patient.dateOfBirth)
  // Chief complaint comes from the doctor's written entry, not receptionist's intake note
  const chiefComplaint = rx?.chiefComplaint ?? ""
  const diagnosis = rx?.diagnosis ?? ""
  const medicalAlerts = rx?.medicalAlerts ?? []
  const onExamination = rx?.onExamination ?? []
  const treatments = rx?.treatments ?? []
  const medicines = rx?.medicines ?? []
  const clinicalNotes = rx?.clinicalNotes ?? []

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
          .print-doc { max-width: 100% !important; margin: 0 auto !important; }
          /* Repeat the letterhead + footer on every printed page; content flows between */
          .print-doc thead { display: table-header-group; }
          .print-doc tfoot { display: table-footer-group; }
          /* A4 (297mm) less the 6mm margins, the letterhead and the footer strip —
             keeps the pad's proportions when the doctor writes only a line or two. */
          .rx-body { min-height: 200mm; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; font-size: 15px; color: #000; }
        /* Fixed pad template on screen too, so the preview matches the printout. */
        .rx-body { min-height: 720px; }
        /* "Updates only" overprint: hide the whole sheet but keep its layout so ONLY
           the clinical notes print — landing in the blank space of the physical copy
           when it's fed back through the printer. Applies on screen + print to match. */
        .overprint { visibility: hidden; }
        .overprint .rx-notes, .overprint .rx-notes * { visibility: visible; }
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
            docNo={`RX-${visit.patient.patientId}-v${rxVersion}`}
            branchName={visit.branch.name}
          />
        </div>
      )}

      {/* Print-mode toggle: whole prescription vs only the new clinical notes */}
      {clinicalNotes.length > 0 && (
        <div className="no-print fixed top-16 right-4 z-50 flex gap-1 bg-white rounded-lg border border-[#E0E3E5] p-1 shadow-sm">
          <a href={`/print/prescription/${visitId}`}
            className="px-3 py-1.5 rounded-md text-xs font-medium"
            style={updatesOnly ? { color: "#707882" } : { backgroundColor: "#005E97", color: "white" }}>
            Whole
          </a>
          <a href={`/print/prescription/${visitId}?mode=updates`}
            className="px-3 py-1.5 rounded-md text-xs font-medium"
            style={updatesOnly ? { backgroundColor: "#005E97", color: "white" } : { color: "#707882" }}
            title="Prints only the new clinical notes in place — feed the original prescription back into the printer">
            Updates only
          </a>
        </div>
      )}

      {/* Whole prescription, or (updates-only) the SAME layout with everything hidden
          except the clinical notes, so the new part overprints the physical copy. */}
      <table className={`print-doc mx-auto ${updatesOnly ? "overprint" : ""}`} style={{ maxWidth: 780, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><td style={{ padding: 0 }}>
            <img src="/hader1.jpg" alt="Ur's Toothfully" className="w-full block" style={{ backgroundColor: GREY }} />
          </td></tr>
        </thead>
        <tfoot>
          <tr><td style={{ padding: 0 }}>
            <img src="/fotter2.jpg" alt="Branches" className="w-full block" />
          </td></tr>
        </tfoot>
        <tbody><tr><td style={{ padding: 0 }}>
        <div className="rx-body flex items-stretch">
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
            {diagnosis ? (
              <p className="text-[14px] whitespace-pre-line min-h-[90px]">{diagnosis}</p>
            ) : (
              <div className="min-h-[90px]" />
            )}
          </div>

          {/* ── Right white column ───────────────────────────── */}
          <div style={{ width: "62%" }} className="px-8 py-4 flex flex-col">
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
                {formatDate(record?.documentDate ?? record?.createdAt ?? new Date())}
              </span>
            </div>

            {/* On examination — doctor's clinical findings (hidden when empty) */}
            {onExamination.length > 0 && (
              <>
                <p className="font-bold text-[13px] mt-6 mb-1 tracking-wide">ON EXAMINATION</p>
                <ul className="text-[14px] space-y-1">
                  {onExamination.map((f, i) => (
                    <li key={i}>
                      •{" "}
                      {f.toothNumbers
                        ? <><strong>{toothLabel(f.toothNumbers)}:</strong>{" "}</>
                        : null}
                      {f.finding}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Treatment plan — planned treatments (no prices) */}
            {treatments.length > 0 && (
              <div className="mt-5">
                <p className="font-bold text-[13px] mb-1 tracking-wide">TREATMENT PLAN</p>
                <ul className="text-[14px] space-y-1">
                  {treatments.map((t, i) => (
                    <li key={i}>
                      •{" "}
                      <span className="font-medium">{t.treatmentName}</span>
                      {t.toothNumber
                        ? <> — {toothLabel(t.toothNumber)}</>
                        : null}
                      {t.quantity > 1 ? <> × {t.quantity}</> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rx */}
            <p className="font-bold text-[20px] mt-6 mb-2">RX</p>
            {medicines.length > 0 && (
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
            )}

            {/* Advice */}
            {rx?.advice ? (
              <div className="mt-3">
                <p className="font-bold text-[13px] mb-1 tracking-wide">ADVICE</p>
                <p className="text-[14px] whitespace-pre-line">{rx.advice}</p>
              </div>
            ) : null}

            {/* Clinical notes — at the bottom of the Rx (white column); flows to a
                new page (letterhead + footer repeat) only when the sheet fills up. */}
            {clinicalNotes.length > 0 && (
              <div className="mt-6 rx-notes">
                <p className="font-bold text-[13px] mb-2 tracking-wide">CLINICAL NOTES</p>
                <div className="space-y-2.5">
                  {clinicalNotes.map((n, i) => (
                    <div key={i} className="flex gap-3 text-[14px]" style={{ breakInside: "avoid" }}>
                      <span className="font-semibold whitespace-nowrap" style={{ minWidth: 110, color: "#005E97" }}>{fmtNoteDate(n.date)}</span>
                      <span className="whitespace-pre-line flex-1">{n.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next visit + signature — pushed to the foot of the sheet, so a
                short prescription still prints on the full pad template */}
            <div className="flex items-end justify-between mt-8 pt-2" style={{ breakInside: "avoid", marginTop: "auto" }}>
              <div className="flex items-end gap-2 text-[15px]">
                <span className="whitespace-nowrap">NEXT VISIT:</span>
                <span style={{ borderBottom: `1px solid ${LINE}`, minWidth: 150, textAlign: "center" }} className="text-[16px]">
                  {rx?.followUpDate ? formatDate(new Date(rx.followUpDate)) : " "}
                </span>
              </div>
              <div className="text-center">
                <div className="flex items-end justify-center" style={{ borderBottom: "1px solid #666", width: 180, height: 40 }}>
                  {visit.doctor?.signatureData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visit.doctor.signatureData} alt="Signature" style={{ maxHeight: 38, maxWidth: 170, objectFit: "contain" }} />
                  ) : null}
                </div>
                <p className="text-[12px] mt-1">
                  {visit.doctor ? `Dr. ${visit.doctor.name.replace(/^Dr\.?\s*/i, "")}` : "Doctor"}
                  {visit.doctor?.doctorRegNo ? ` · Reg: ${visit.doctor.doctorRegNo}` : ""}
                </p>
              </div>
            </div>

          </div>
        </div>
        </td></tr></tbody>
      </table>
    </>
  )
}
