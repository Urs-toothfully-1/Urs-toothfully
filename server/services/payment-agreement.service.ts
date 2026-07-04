import { paymentAgreementRepository } from "@/server/repositories/payment-agreement.repository"
import { suggestPaymentSchedule, PaymentStage } from "@/lib/payment-agreement"
import { prisma } from "@/lib/prisma"

export const paymentAgreementService = {
  /**
   * Returns the saved agreement for an estimate, or auto-generates a suggested
   * schedule from the estimate total without persisting it yet.
   */
  async getOrSuggest(estimateId: string) {
    const existing = await paymentAgreementRepository.findByEstimate(estimateId)
    if (existing) return existing

    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      select: { total: true },
    })
    if (!estimate) throw new Error("Estimate not found")

    const stages = suggestPaymentSchedule(Number(estimate.total))
    return {
      id: null,
      estimateId,
      stages,
      clinicRepresentative: null,
      termsAccepted: false,
      patientSignedAt: null,
      createdAt: null,
      updatedAt: null,
    }
  },

  async save(
    estimateId: string,
    stages: PaymentStage[],
    clinicRepresentative: string | null,
    termsAccepted: boolean,
    patientSignedAt: Date | null
  ) {
    return paymentAgreementRepository.upsert(estimateId, {
      stages,
      clinicRepresentative,
      termsAccepted,
      patientSignedAt,
    })
  },
}
