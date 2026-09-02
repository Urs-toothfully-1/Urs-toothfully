import { prisma } from "@/lib/prisma"
import { Prisma, PrescriptionMode } from "@prisma/client"

export const prescriptionRepository = {
  async findById(id: string) {
    return prisma.prescriptionRecord.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true, email: true },
        },
        doctor: { select: { id: true, name: true, doctorRegNo: true, doctorQualification: true } },
        visit: { select: { id: true, visitNo: true, branchId: true } },
      },
    })
  },

  async findByVisit(visitId: string) {
    return prisma.prescriptionRecord.findFirst({
      where: { visitId },
      orderBy: { createdAt: "desc" },
      include: {
        patient: {
          select: { id: true, patientId: true, fullName: true, dateOfBirth: true, gender: true, mobile: true, email: true },
        },
        doctor: { select: { id: true, name: true, doctorRegNo: true, doctorQualification: true } },
        visit: { select: { id: true, visitNo: true, branchId: true } },
      },
    })
  },

  async create(data: {
    patientId: string
    visitId: string
    doctorId: string
    mode: PrescriptionMode
    prescriptionData: Prisma.InputJsonValue
  }) {
    return prisma.prescriptionRecord.create({ data })
  },

  async updateData(id: string, prescriptionData: Prisma.InputJsonValue) {
    return prisma.prescriptionRecord.update({
      where: { id },
      data: { prescriptionData },
    })
  },

  async markPrinted(id: string) {
    return prisma.prescriptionRecord.update({
      where: { id },
      data: { printedAt: new Date() },
    })
  },

  async setDocumentDate(id: string, documentDate: Date) {
    return prisma.prescriptionRecord.update({
      where: { id },
      data: { documentDate },
    })
  },
}
