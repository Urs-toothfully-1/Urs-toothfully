import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { prescriptionService } from "@/server/services/prescription.service"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { EstimateWizard } from "@/components/estimates/EstimateWizard"
import type { PrescriptionData } from "@/lib/prescription-types"
import type { PaymentStage } from "@/lib/payment-agreement"

export const metadata: Metadata = { title: "Consultation" }
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ visitId: string }> }

export default async function ConsultationPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role === "RECEPTIONIST") redirect("/reception")

  const { visitId } = await params

  const visit = await prisma.patientVisit.findUnique({
    where: { id: visitId },
    include: {
      patient: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
    },
  })
  if (!visit) notFound()

  // Ensure a prescription exists for this visit
  let prescription = await prescriptionService.getByVisit(visitId)
  if (!prescription) {
    prescription = (await prescriptionService.ensureForVisit(visitId, session.userId).catch(() => null)) as typeof prescription
  }

  // Estimate is optional — it may not exist yet (prescription-only consultation)
  const existing = await estimateRepository.findByVisit(visitId)
  const estimate = existing ? await estimateRepository.findById(existing.id) : null

  const [paymentAgreement, queueEntry, examTemplates, treatments, allowDisc] = await Promise.all([
    estimate ? paymentAgreementService.getOrSuggest(estimate.id) : Promise.resolve(null),
    queueRepository.findByVisit(visitId),
    prisma.examinationTemplate
      .findMany({ where: { doctorId: session.userId }, orderBy: { name: "asc" }, select: { id: true, name: true, finding: true } })
      .catch(() => []),
    treatmentRepository.findAll(),
    settingsRepository.get("allow_discount", visit.branchId),
  ])

  const prescriptionData = (prescription?.prescriptionData ?? {}) as unknown as PrescriptionData

  // The patient's most recent prescription from an EARLIER visit — lets the doctor
  // continue the last prescription or start a new one on a repeat consultation.
  const prevRecords = await prisma.prescriptionRecord.findMany({
    where: { patientId: visit.patientId, visitId: { not: visitId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { prescriptionData: true },
  })
  const prevData = prevRecords
    .map((r) => r.prescriptionData as unknown as PrescriptionData | null)
    .find((d) => d && ((d.treatments?.length ?? 0) > 0 || (d.medicines?.length ?? 0) > 0 || (d.onExamination?.length ?? 0) > 0 || d.chiefComplaint)) ?? null
  const previousPrescription = prevData
    ? {
        chiefComplaint: prevData.chiefComplaint,
        onExamination: prevData.onExamination,
        treatments: prevData.treatments,
        medicines: prevData.medicines,
        advice: prevData.advice,
      }
    : null

  return (
    <EstimateWizard
      estimateId={estimate?.id ?? null}
      estimateNo={estimate?.estimateNo ?? null}
      estimateItems={estimate ? (estimate.items as any[]).map((i) => ({
        id: i.id,
        treatmentId: i.treatmentId ?? null,
        treatmentName: i.treatmentName,
        category: i.category,
        toothNumber: i.toothNumber ?? null,
        quantity: i.quantity,
        unitRate: Number(i.unitRate),
        plannedSittings: i.plannedSittings ?? 1,
        status: i.status,
      })) : []}
      estimateNotes={estimate?.notes ?? null}
      estimateDiscount={estimate?.discountPercent ? Number(estimate.discountPercent) : null}
      estimateTotal={estimate ? Number(estimate.total) : null}
      patientName={visit.patient.fullName}
      patientId={visit.patientId}
      visitId={visitId}
      visitNo={visit.visitNo}
      branchId={visit.branchId}
      doctorName={visit.doctor?.name ?? session.name}
      branchName={visit.branch.name}
      prescriptionId={prescription?.id ?? null}
      prescriptionData={prescriptionData}
      previousPrescription={previousPrescription}
      initialTemplates={examTemplates}
      treatments={(treatments as any[]).map((t) => ({
        id: t.id, category: t.category, name: t.name, defaultAmount: Number(t.defaultAmount),
      }))}
      allowDiscount={(allowDisc ?? "true") === "true"}
      paymentAgreementStages={(paymentAgreement?.stages ?? []) as PaymentStage[]}
      paymentAgreementRep={paymentAgreement?.clinicRepresentative ?? null}
      paymentAgreementTermsAccepted={paymentAgreement?.termsAccepted ?? false}
      paymentAgreementSignedAt={paymentAgreement?.patientSignedAt?.toISOString() ?? null}
      queueId={queueEntry?.id ?? null}
    />
  )
}
