import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { queueRepository } from "@/server/repositories/queue.repository"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { toothLabel } from "@/lib/teeth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SessionActions } from "./SessionActions"
import { SittingsTracker } from "@/components/estimates/SittingsTracker"
import { VisitPrescriptionButton } from "@/components/queue/VisitPrescriptionButton"
import { BookFollowUpDialog } from "@/components/appointments/BookFollowUpDialog"
import { SessionClinicalNotes } from "@/components/clinical-notes/SessionClinicalNotes"
import {
  ChevronLeft,
  User,
  Phone,
  AlertTriangle,
  Heart,
  Pill,
  Activity,
  Stethoscope,
  FileText,
  FileSignature,
  CheckCircle2,
} from "lucide-react"

export const metadata: Metadata = { title: "Treatment Session" }
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ queueId: string }> }

function calcAge(dob: Date): number {
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export default async function TreatmentSessionPage({ params }: Props) {
  const session = await requireRole(["DOCTOR", "ADMIN"])
  const { queueId } = await params

  const entry = await queueRepository.findSessionDetails(queueId)
  if (!entry) notFound()

  // Only the assigned doctor (or admin) may view
  if (session.role !== "ADMIN" && entry.doctorId !== session.userId) {
    redirect("/doctor")
  }

  const pendingItems = await estimateRepository.findPendingItemsByPatients([entry.patient.id])

  const history = entry.patient.dentalHistories[0] ?? null
  const age = calcAge(new Date(entry.patient.dateOfBirth))

  // Build medical alerts list
  const alerts: string[] = []
  if (history?.allergies) alerts.push("Allergies")
  if (history?.diabetes) alerts.push("Diabetes")
  if (history?.bloodPressure) alerts.push(`BP (${history.bloodPressureType ?? "Unknown"})`)
  if (history?.heartProblems) alerts.push("Heart Problems")
  if (history?.heartSurgery) alerts.push("Heart Surgery")
  if (history?.epilepsy) alerts.push("Epilepsy")
  if (history?.hivAids) alerts.push("HIV/AIDS")
  if (history?.hepatitis) alerts.push(`Hepatitis${history.hepatitisType ? ` ${history.hepatitisType}` : ""}`)
  if (history?.bleedsEasily) alerts.push("Bleeds Easily")
  if (history?.pregnant) alerts.push("Pregnant")

  // Full pending items with rates (from findPendingItemsByPatients we only have basic fields)
  // We need to fetch full details separately
  const fullItems = pendingItems.length
    ? await prisma.estimateItem.findMany({
        where: { id: { in: pendingItems.map((i) => i.id) } },
        select: {
          id: true,
          treatmentName: true,
          toothNumber: true,
          quantity: true,
          unitRate: true,
          amount: true,
          status: true,
          category: true,
          plannedSittings: true,
          completedSittings: true,
        },
        orderBy: { sortOrder: "asc" },
      })
    : []

  // The active estimate that these treatments belong to (for editable estimate + agreement)
  const activeEstimateId = (pendingItems[0] as any)?.estimate?.id as string | undefined

  // Clinical-notes log lives on the consultation prescription (the estimate's visit)
  // so notes accumulate across treatment sessions into one printable document.
  let notesVisitId = entry.visit.id
  if (activeEstimateId) {
    const est = await prisma.estimate.findUnique({ where: { id: activeEstimateId }, select: { visitId: true } })
    if (est) notesVisitId = est.visitId
  }
  const notesPrescription = await prisma.prescriptionRecord.findFirst({
    where: { visitId: notesVisitId },
    orderBy: { createdAt: "desc" },
    select: { prescriptionData: true },
  })
  const existingNotes = (((notesPrescription?.prescriptionData as any)?.clinicalNotes ?? []) as { date: string; note: string }[])

  // "What's missing" for a return visit: which of the 3 consultation docs exist
  const hasPrescription = !!notesPrescription
  const hasEstimate = !!activeEstimateId
  const hasAgreement = activeEstimateId
    ? !!(await prisma.paymentAgreement.findFirst({ where: { estimateId: activeEstimateId }, select: { id: true } }))
    : false

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Back nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/doctor"
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Queue
        </Link>
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor:
              entry.status === "WAITING"
                ? "#FEF3C7"
                : entry.status === "WITH_DOCTOR"
                ? "#DBEAFE"
                : entry.status === "COMPLETED"
                ? "#D1FAE5"
                : "#F2F4F6",
            color:
              entry.status === "WAITING"
                ? "#92400E"
                : entry.status === "WITH_DOCTOR"
                ? "#1E40AF"
                : entry.status === "COMPLETED"
                ? "#065F46"
                : "#707882",
          }}
        >
          {entry.status.replace("_", " ")}
        </span>
      </div>

      {/* Patient banner */}
      <Card className="border-[#E0E3E5] overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xl font-bold"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {entry.patient.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
                  {entry.patient.fullName}
                </h1>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: "#F2F4F6", color: "#005E97" }}
                >
                  {entry.patient.patientId}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#E0F2FE", color: "#0369A1" }}
                >
                  Token #{entry.tokenNumber}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {entry.patient.gender === "MALE" ? "Male" : entry.patient.gender === "FEMALE" ? "Female" : "Other"} · {age} yrs
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {entry.patient.mobile}
                </span>
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {entry.doctor ? `Dr. ${entry.doctor.name.replace(/^Dr\.?\s*/i, "")}` : "Unassigned"}
                </span>
              </div>
              {entry.visit.chiefComplaint && (
                <p className="text-sm mt-1.5 italic" style={{ color: BRAND_COLORS.borderDivider }}>
                  &ldquo;{entry.visit.chiefComplaint}&rdquo;
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medical alerts strip */}
      {alerts.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl flex-wrap"
          style={{ backgroundColor: "#FFF7ED", border: "1px solid #FDBA74" }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#C2410C" }} />
          <span className="text-sm font-semibold" style={{ color: "#C2410C" }}>
            Medical Alerts:
          </span>
          {alerts.map((a) => (
            <span
              key={a}
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#FED7AA", color: "#9A3412" }}
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Main grid: medical history + treatments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Medical History */}
        <Card className="border-[#E0E3E5]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: "#F2F4F6" }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Heart className="h-4 w-4" style={{ color: "#EF4444" }} />
              Medical History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            {!history ? (
              <p style={{ color: BRAND_COLORS.borderDivider }}>No medical history on file.</p>
            ) : (
              <>
                {/* Conditions grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Allergies", value: history.allergies, detail: history.allergiesDetail },
                    { label: "Diabetes", value: history.diabetes },
                    { label: "Blood Pressure", value: history.bloodPressure, detail: history.bloodPressureType },
                    { label: "Heart Problems", value: history.heartProblems, detail: history.heartProblemsDetail },
                    { label: "Heart Surgery", value: history.heartSurgery, detail: history.heartSurgeryDetail },
                    { label: "Epilepsy", value: history.epilepsy, detail: history.epilepsyDetail },
                    { label: "HIV/AIDS", value: history.hivAids },
                    { label: "Hepatitis", value: history.hepatitis, detail: history.hepatitisType },
                    { label: "Kidney/Liver", value: history.kidneyLiver },
                    { label: "Respiratory", value: history.respiratory },
                    { label: "Bleeds Easily", value: history.bleedsEasily },
                    { label: "Pregnant", value: history.pregnant },
                    { label: "Smoker", value: history.smoker },
                    { label: "Fainting", value: history.fainting },
                  ]
                    .filter((c) => c.value)
                    .map((c) => (
                      <div
                        key={c.label}
                        className="px-3 py-2 rounded-lg"
                        style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA" }}
                      >
                        <p className="text-xs font-semibold" style={{ color: "#9A3412" }}>
                          {c.label}
                        </p>
                        {c.detail && (
                          <p className="text-xs mt-0.5" style={{ color: "#C2410C" }}>
                            {c.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  {alerts.length === 0 && (
                    <div
                      className="col-span-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: "#D1FAE5", border: "1px solid #A7F3D0" }}
                    >
                      <p className="text-xs font-semibold" style={{ color: "#065F46" }}>
                        No significant medical conditions reported
                      </p>
                    </div>
                  )}
                </div>

                {/* Medications */}
                {history.currentMedications && (
                  <div className="pt-2 border-t" style={{ borderColor: "#F2F4F6" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Pill className="h-3.5 w-3.5" style={{ color: "#7C3AED" }} />
                      <span className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                        Current Medications
                      </span>
                    </div>
                    <p className="text-sm px-2" style={{ color: BRAND_COLORS.borderDivider }}>
                      {history.currentMedications}
                    </p>
                  </div>
                )}

                {/* General health notes */}
                {history.generalHealthNotes && (
                  <div className="pt-2 border-t" style={{ borderColor: "#F2F4F6" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.primaryTeal }} />
                      <span className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                        General Health Notes
                      </span>
                    </div>
                    <p className="text-sm px-2" style={{ color: BRAND_COLORS.borderDivider }}>
                      {history.generalHealthNotes}
                    </p>
                  </div>
                )}

                {/* Dental notes */}
                {history.previousTreatment && (
                  <div className="pt-2 border-t" style={{ borderColor: "#F2F4F6" }}>
                    <span className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                      Previous Dental Treatment
                    </span>
                    <p className="text-sm mt-0.5 px-2" style={{ color: BRAND_COLORS.borderDivider }}>
                      {history.previousTreatment}
                    </p>
                  </div>
                )}

                {/* Dental conditions */}
                {(history.sensitiveTeeth || history.gumsBleed || history.looseTeeth || history.grinding || history.foodCatching) && (
                  <div className="pt-2 border-t" style={{ borderColor: "#F2F4F6" }}>
                    <span className="text-xs font-semibold mb-2 block" style={{ color: BRAND_COLORS.bodyText }}>
                      Dental Conditions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {history.sensitiveTeeth && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Sensitive Teeth</span>}
                      {history.gumsBleed && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Gums Bleed</span>}
                      {history.looseTeeth && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Loose Teeth</span>}
                      {history.grinding && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Grinding</span>}
                      {history.foodCatching && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EDE9FE", color: "#5B21B6" }}>Food Catching</span>}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Treatments */}
        <Card className="border-[#E0E3E5]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: "#F2F4F6" }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Stethoscope className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Pending Treatments
              <span
                className="ml-auto text-xs px-2 py-0.5 rounded-full font-normal"
                style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
              >
                {fullItems.length} item{fullItems.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {fullItems.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: BRAND_COLORS.borderDivider }}>
                No pending treatments found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid #F2F4F6` }}>
                      {["#", "Treatment", "Tooth", "Qty", "Rate", "Amount"].map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-2 text-xs font-semibold"
                          style={{ color: BRAND_COLORS.borderDivider }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fullItems.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #F7F9FB" }}>
                        <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-2">
                          <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                            {item.treatmentName}
                          </p>
                          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                            {item.category}
                          </p>
                        </td>
                        <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                          {toothLabel(item.toothNumber) || "—"}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-center" style={{ color: BRAND_COLORS.bodyText }}>
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                          {formatCurrency(Number(item.unitRate))}
                        </td>
                        <td className="py-2.5 px-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                          {formatCurrency(Number(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid #E0E3E5` }}>
                      <td colSpan={5} className="py-2 px-2 text-xs font-semibold text-right" style={{ color: BRAND_COLORS.borderDivider }}>
                        Total Pending
                      </td>
                      <td className="py-2 px-2 text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
                        {formatCurrency(fullItems.reduce((s, i) => s + Number(i.amount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session documents — prescription (this visit), estimate & agreement (editable) */}
      <Card className="border-[#E0E3E5]">
        <CardHeader className="pb-3 border-b" style={{ borderColor: "#F2F4F6" }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Session Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* What's present vs still needed for this patient */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { label: "Prescription", ok: hasPrescription },
              { label: "Estimate", ok: hasEstimate },
              { label: "Payment Plan", ok: hasAgreement },
            ] as const).map((d) => (
              <span key={d.label} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={d.ok
                  ? { backgroundColor: "#D1FAE5", color: "#065F46" }
                  : { backgroundColor: "#FEF3C7", color: "#92400E" }}>
                {d.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {d.label}: {d.ok ? "Ready" : "Needed"}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {/* New prescription for this treatment visit */}
            <VisitPrescriptionButton visitId={entry.visit.id} />

            {/* Book a follow-up appointment during treatment */}
            <BookFollowUpDialog patientId={entry.patient.id} branchId={entry.branchId} patientName={entry.patient.fullName} />

            {/* Editable estimate + treatment agreement */}
            {activeEstimateId ? (
              <Link
                href={`/doctor/estimate/${activeEstimateId}/wizard`}
                className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: "#F2F4F6", color: BRAND_COLORS.bodyText }}
              >
                <FileSignature className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
                Estimate &amp; Agreement
              </Link>
            ) : (
              <span className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "#F2F4F6", color: BRAND_COLORS.borderDivider }}>
                No estimate on file
              </span>
            )}
          </div>
          <p className="text-xs mt-3" style={{ color: BRAND_COLORS.borderDivider }}>
            Fill a fresh prescription for today&apos;s visit, or open the estimate to edit treatments, rates, sittings and the payment agreement.
          </p>
        </CardContent>
      </Card>

      {/* Clinical notes — logged onto the prescription, printable with continuation pages */}
      <SessionClinicalNotes visitId={notesVisitId} initialNotes={existingNotes} hasPrescription={!!notesPrescription} />

      {/* Sittings tracker — pick which treatments were worked on today */}
      {entry.status === "WITH_DOCTOR" && fullItems.length > 0 && (
        <Card className="border-[#E0E3E5]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: "#F2F4F6" }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Stethoscope className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Sittings Done Today
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <SittingsTracker
              patientId={entry.patient.id}
              items={fullItems.map((i) => ({
                id: i.id,
                treatmentName: i.treatmentName,
                toothNumber: i.toothNumber,
                plannedSittings: i.plannedSittings ?? 1,
                completedSittings: i.completedSittings ?? 0,
                status: i.status,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Session action */}
      {["WAITING", "WITH_DOCTOR"].includes(entry.status) && (
        <Card className="border-[#E0E3E5]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: "#F2F4F6" }}>
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
              {entry.status === "WAITING" ? "Start Treatment Session" : "Complete Treatment Session"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <SessionActions
              queueId={entry.id}
              patientId={entry.patient.id}
              status={entry.status}
              items={fullItems.map((i) => ({
                id: i.id,
                treatmentName: i.treatmentName,
                toothNumber: i.toothNumber,
                quantity: i.quantity,
                unitRate: Number(i.unitRate),
                amount: Number(i.amount),
                status: i.status,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {entry.status === "COMPLETED" && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "#D1FAE5", border: "1px solid #A7F3D0" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#065F46" }}>
            ✓ This treatment session has been completed.
          </span>
        </div>
      )}
    </div>
  )
}
