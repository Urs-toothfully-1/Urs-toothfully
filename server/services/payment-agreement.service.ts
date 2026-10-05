import { paymentAgreementRepository } from "@/server/repositories/payment-agreement.repository"
import { suggestPaymentSchedule, PaymentStage } from "@/lib/payment-agreement"
import { prisma } from "@/lib/prisma"
import { defaultPaymentOptions, parsePaymentOptions, type PaymentOption } from "@/lib/payment-options"

export const paymentAgreementService = {
  /**
   * Returns the saved agreement for an estimate, or auto-generates a suggested
   * schedule from the estimate total without persisting it yet.
   */
  async getOrSuggest(estimateId: string) {
    const [existing, estimate] = await Promise.all([
      paymentAgreementRepository.findByEstimate(estimateId),
      prisma.estimate.findUnique({ where: { id: estimateId }, select: { total: true, invoiceBilling: true } }),
    ])
    if (!estimate) throw new Error("Estimate not found")

    // Quote-only estimates carry payment *options* (printed offers) rather than a
    // stage schedule — nothing is "due" until treatment is invoiced.
    if (estimate.invoiceBilling) {
      const saved = existing ? parsePaymentOptions(existing.options) : []
      return {
        ...(existing ?? { id: null, estimateId, clinicRepresentative: null, termsAccepted: false, patientSignedAt: null, createdAt: null, updatedAt: null }),
        stages: [] as PaymentStage[],
        options: existing?.options != null ? saved : defaultPaymentOptions(),
      }
    }

    if (existing) return { ...existing, options: [] as PaymentOption[] }
    const stages = suggestPaymentSchedule(Number(estimate.total))
    return {
      id: null,
      estimateId,
      options: [] as PaymentOption[],
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
    patientSignedAt: Date | null,
    options?: PaymentOption[]
  ) {
    if (stages.length === 0 && !options?.length) {
      await prisma.paymentAgreement.deleteMany({ where: { estimateId } })
      return null
    }
    return paymentAgreementRepository.upsert(estimateId, {
      stages,
      clinicRepresentative,
      termsAccepted,
      patientSignedAt,
      options,
    })
  },
}
