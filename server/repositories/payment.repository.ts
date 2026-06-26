import { prisma } from "@/lib/prisma"
import { PaymentMode, PaymentType, Prisma } from "@prisma/client"

export const paymentRepository = {
  async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        estimate: { select: { id: true, estimateNo: true } },
        visit: { select: { id: true, visitNo: true } },
        receipt: true,
        collectedBy: { select: { id: true, name: true } },
      },
    })
  },

  async findByPatient(patientId: string) {
    return prisma.payment.findMany({
      where: { patientId, isDeleted: false },
      include: {
        branch: { select: { id: true, name: true } },
        estimate: { select: { id: true, estimateNo: true } },
        receipt: { select: { id: true, receiptNo: true } },
        collectedBy: { select: { id: true, name: true } },
      },
      orderBy: { paymentDate: "desc" },
    })
  },

  async findByEstimate(estimateId: string) {
    return prisma.payment.findMany({
      where: {
        estimateId,
        isDeleted: false,
        paymentType: { in: [PaymentType.ADVANCE, PaymentType.TREATMENT] },
      },
      select: { id: true, amount: true, paymentType: true, paymentDate: true, mode: true },
      orderBy: { paymentDate: "asc" },
    })
  },

  async createWithReceiptAndAccounting(data: {
    paymentType: PaymentType
    estimateId?: string
    visitId?: string
    patientId: string
    branchId: string
    amount: Prisma.Decimal
    mode: PaymentMode
    transactionRef?: string
    notes?: string
    collectedById: string
    receiptNo: string
    issuedById: string
  }) {
    const { receiptNo, issuedById, ...paymentData } = data

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: paymentData })

      const receipt = await tx.receipt.create({
        data: {
          receiptNo,
          paymentId: payment.id,
          patientId: data.patientId,
          branchId: data.branchId,
          issuedById,
        },
      })

      await tx.accountingEntry.create({
        data: {
          paymentId: payment.id,
          branchId: data.branchId,
          patientId: data.patientId,
          entryDate: new Date(),
          amount: data.amount,
          paymentMode: data.mode,
          paymentType: data.paymentType,
          entryType: "RECEIPT",
          status: "PENDING_REVIEW",
        },
      })

      return { payment, receipt }
    })
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    await prisma.payment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason },
    })
  },

  async getLatestReceiptNoForYear(year: number): Promise<string | null> {
    const result = await prisma.receipt.findFirst({
      where: { receiptNo: { startsWith: `RCP-${year}-` } },
      orderBy: { receiptNo: "desc" },
      select: { receiptNo: true },
    })
    return result?.receiptNo ?? null
  },
}
