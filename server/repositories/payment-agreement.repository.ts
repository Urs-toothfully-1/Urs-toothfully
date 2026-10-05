import { prisma } from "@/lib/prisma"
import { PaymentStage } from "@/lib/payment-agreement"
import type { PaymentOption } from "@/lib/payment-options"

export const paymentAgreementRepository = {
  async findByEstimate(estimateId: string) {
    return prisma.paymentAgreement.findUnique({ where: { estimateId } })
  },

  async findByEstimateIds(estimateIds: string[]) {
    if (!estimateIds.length) return []
    return prisma.paymentAgreement.findMany({
      where: { estimateId: { in: estimateIds } },
    })
  },

  async upsert(
    estimateId: string,
    data: {
      stages: PaymentStage[]
      clinicRepresentative?: string | null
      termsAccepted?: boolean
      patientSignedAt?: Date | null
      options?: PaymentOption[] // only written when given — stage updates leave saved offers alone
    }
  ) {
    const opts = data.options !== undefined ? { options: data.options as unknown as object[] } : {}
    return prisma.paymentAgreement.upsert({
      where: { estimateId },
      create: {
        estimateId,
        stages: data.stages as object[],
        clinicRepresentative: data.clinicRepresentative ?? null,
        termsAccepted: data.termsAccepted ?? false,
        patientSignedAt: data.patientSignedAt ?? null,
        ...opts,
      },
      update: {
        stages: data.stages as object[],
        clinicRepresentative: data.clinicRepresentative ?? null,
        termsAccepted: data.termsAccepted ?? false,
        patientSignedAt: data.patientSignedAt ?? null,
        ...opts,
      },
    })
  },
}
