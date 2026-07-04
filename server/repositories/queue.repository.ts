import { prisma } from "@/lib/prisma"
import { QueueStatus } from "@prisma/client"

export const queueRepository = {
  async findByBranchAndDate(branchId: string, date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.queueEntry.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, mobile: true } },
        doctor: { select: { id: true, name: true } },
        visit: { select: { id: true, visitNo: true, visitType: true, chiefComplaint: true } },
      },
      orderBy: { tokenNumber: "asc" },
    })
  },

  async findByDoctorAndDate(doctorId: string, date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.queueEntry.findMany({
      where: {
        doctorId,
        createdAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true, mobile: true } },
        visit: { select: { id: true, visitNo: true, visitType: true, chiefComplaint: true } },
      },
      orderBy: { tokenNumber: "asc" },
    })
  },

  async findByVisit(visitId: string) {
    return prisma.queueEntry.findFirst({
      where: { visitId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, branchId: true, doctorId: true },
    })
  },

  async findById(id: string) {
    return prisma.queueEntry.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true } },
        doctor: { select: { id: true, name: true } },
        visit: true,
      },
    })
  },

  async create(data: {
    visitId: string
    patientId: string
    branchId: string
    doctorId?: string
    tokenNumber: number
    createdById: string
  }) {
    return prisma.queueEntry.create({ data })
  },

  async updateStatus(id: string, status: QueueStatus, extras?: {
    doctorId?: string
    claimedAt?: Date
    calledAt?: Date
    completedAt?: Date
  }) {
    return prisma.queueEntry.update({
      where: { id },
      data: { status, ...extras },
    })
  },

  async getNextTokenNumber(branchId: string, date: Date): Promise<number> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const last = await prisma.queueEntry.findFirst({
      where: { branchId, createdAt: { gte: start, lte: end } },
      orderBy: { tokenNumber: "desc" },
      select: { tokenNumber: true },
    })
    return (last?.tokenNumber ?? 0) + 1
  },

  async findActiveForPatientToday(patientId: string, branchId: string) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    return prisma.queueEntry.findFirst({
      where: {
        patientId,
        branchId,
        createdAt: { gte: start, lte: end },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true, status: true, tokenNumber: true },
    })
  },

  async findWaitingForNextAvailable(branchId: string) {
    return prisma.queueEntry.findMany({
      where: { branchId, status: "WAITING", doctorId: null },
      include: {
        patient: { select: { id: true, patientId: true, fullName: true } },
        visit: { select: { id: true, visitType: true } },
      },
      orderBy: { tokenNumber: "asc" },
    })
  },
}
