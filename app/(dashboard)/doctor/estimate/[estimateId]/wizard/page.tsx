import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { prescriptionService } from "@/server/services/prescription.service"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { queueRepository } from "@/server/repositories/queue.repository"
import { prisma } from "@/lib/prisma"
import { EstimateWizard } from "@/components/estimates/EstimateWizard"
import type { PrescriptionData } from "@/lib/prescription-types"
import type { PaymentStage } from "@/lib/payment-agreement"

export const metadata: Metadata = { title: "Estimate Wizard" }

type Props = { params: Promise<{ estimateId: string }> }

export default async function EstimateWizardPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role === "RECEPTIONIST") redirect("/reception")

  const { estimateId } = await params
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()

  // Ensure prescription exists (auto-create if missing)
  let prescription = await prescriptionService.getByVisit(estimate.visitId)
  if (!prescription) {
    prescription = await prescriptionService
      .createFromEstimate(estimate.id, session.userId)
      .catch(() => null) as typeof prescription
  }

  const [paymentAgreement, queueEntry, examTemplates] = await Promise.all([
    paymentAgreementService.getOrSuggest(estimateId),
    queueRepository.findByVisit(estimate.visitId),
    session.role === "DOCTOR" || session.role === "ADMIN"
      ? prisma.examinationTemplate
          .findMany({
            where: { doctorId: session.userId },
            orderBy: { name: "asc" },
            select: { id: true, name: true, finding: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ])

  const prescriptionData = (prescription?.prescriptionData ?? {}) as unknown as PrescriptionData

  return (
    <EstimateWizard
      estimateId={estimate.id}
      estimateNo={estimate.estimateNo}
      estimateItems={(estimate.items as any[]).map((i) => ({
        id: i.id,
        treatmentName: i.treatmentName,
        category: i.category,
        toothNumber: i.toothNumber ?? null,
        quantity: i.quantity,
        unitRate: Number(i.unitRate),
        amount: Number(i.amount),
        status: i.status,
      }))}
      estimateTotal={Number(estimate.total)}
      estimateSubtotal={Number(estimate.subtotal)}
      estimateDiscount={estimate.discountPercent ? Number(estimate.discountPercent) : null}
      estimateNotes={estimate.notes ?? null}
      patientName={estimate.patient.fullName}
      patientId={estimate.patientId}
      visitId={estimate.visitId}
      doctorName={estimate.doctor.name}
      branchName={estimate.branch.name}
      prescriptionId={prescription?.id ?? null}
      prescriptionData={prescriptionData}
      initialTemplates={examTemplates}
      paymentAgreementStages={(paymentAgreement.stages ?? []) as PaymentStage[]}
      paymentAgreementRep={paymentAgreement.clinicRepresentative ?? null}
      paymentAgreementTermsAccepted={paymentAgreement.termsAccepted ?? false}
      paymentAgreementSignedAt={paymentAgreement.patientSignedAt?.toISOString() ?? null}
      queueId={queueEntry?.id ?? null}
    />
  )
}
