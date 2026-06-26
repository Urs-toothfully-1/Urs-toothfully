import { prisma } from "@/lib/prisma"
import { PatientVisit, VisitStatus, VisitType } from "@prisma/client"

export const visitRepository = {
  async findById(id: string) {
    return prisma.patientVisit.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, mobile: true } },
        branch: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
        queueEntry: true,
      },
    })
  },

  async findByPatient(patientId: string) {
    return prisma.patientVisit.findMany({
      where: { patientId },
      include: {
        branch: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
        queueEntry: { select: { id: true, status: true, tokenNumber: true } },
        estimates: { select: { id: true, estimateNo: true, total: true, status: true } },
      },
      orderBy: { visitDate: "desc" },
    })
  },

  async create(data: {
    visitNo: string
    patientId: string
    branchId: string
    doctorId?: string
    visitType: VisitType
    chiefComplaint?: string
    createdById: string
  }) {
    return prisma.patientVisit.create({
      data,
      include: {
        patient: { select: { id: true, patientId: true, fullName: true } },
        branch: { select: { id: true, name: true } },
      },
    })
  },

  async updateStatus(id: string, status: VisitStatus, doctorId?: string) {
    return prisma.patientVisit.update({
      where: { id },
      data: { status, ...(doctorId && { doctorId }) },
    })
  },

  async getLatestVisitNoForYear(year: number): Promise<string | null> {
    const result = await prisma.patientVisit.findFirst({
      where: { visitNo: { startsWith: `VISIT-${year}-` } },
      orderBy: { visitNo: "desc" },
      select: { visitNo: true },
    })
    return result?.visitNo ?? null
  },
}
