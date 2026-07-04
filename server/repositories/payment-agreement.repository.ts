import { prisma } from "@/lib/prisma"
import { PaymentStage } from "@/lib/payment-agreement"

export const paymentAgreementRepository = {
  async findByEstimate(estimateId: string) {
    return prisma.paymentAgreement.findUnique({ where: { estimateId } })
  },

  async upsert(
    estimateId: string,
    data: {
      stages: PaymentStage[]
      clinicRepresentative?: string | null
      termsAccepted?: boolean
      patientSignedAt?: Date | null
    }
  ) {
    return prisma.paymentAgreement.upsert({
      where: { estimateId },
      create: {
        estimateId,
        stages: data.stages as object[],
        clinicRepresentative: data.clinicRepresentative ?? null,
        termsAccepted: data.termsAccepted ?? false,
        patientSignedAt: data.patientSignedAt ?? null,
      },
      update: {
        stages: data.stages as object[],
        clinicRepresentative: data.clinicRepresentative ?? null,
        termsAccepted: data.termsAccepted ?? false,
        patientSignedAt: data.patientSignedAt ?? null,
      },
    })
  },
}
