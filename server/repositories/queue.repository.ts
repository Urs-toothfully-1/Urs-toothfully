import { prisma } from "@/lib/prisma"
import { QueueStatus } from "@prisma/client"

const OPEN_STATUSES: QueueStatus[] = ["WAITING", "WITH_DOCTOR", "ESTIMATE_CREATED", "PAYMENT_PENDING"]

/** How far back an unfinished visit keeps following the queue forward. */
const CARRY_OVER_DAYS = 14

/**
 * The day's entries PLUS anything still open from an earlier day. Without the
 * carry-over an entry left unfinished at closing time vanished at midnight and
 * could never be completed — reception had no screen that could reach it.
 *
 * ponytail: 14-day window keeps long-abandoned rows out of the live queue. If
 * older ones need closing, give admin a "stale visits" screen rather than
 * widening this.
 */
function dayOrStillOpen(start: Date, end: Date) {
  const carryFrom = new Date(start)
  carryFrom.setDate(carryFrom.getDate() - CARRY_OVER_DAYS)
  return {
    OR: [
      { createdAt: { gte: start, lte: end } },
      { createdAt: { gte: carryFrom, lt: start }, status: { in: OPEN_STATUSES } },
    ],
  }
}

export const queueRepository = {
  async findByBranchAndDate(branchId: string, date: Date) {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    return prisma.queueEntry.findMany({
      where: {
        branchId,
        ...dayOrStillOpen(start, end),
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
        ...dayOrStillOpen(start, end),
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

  /**
   * Atomically claim a WAITING, unclaimed entry for a doctor. The conditional
   * `where` runs as a single UPDATE, so two doctors racing to claim the same
   * entry cannot both succeed — exactly one gets count === 1, the other 0.
   * Returns the number of rows updated (1 = claimed, 0 = already taken).
   */
  async claimIfAvailable(id: string, doctorId: string): Promise<number> {
    const now = new Date()
    const res = await prisma.queueEntry.updateMany({
      where: { id, status: "WAITING", doctorId: null },
      data: { status: "WITH_DOCTOR", doctorId, claimedAt: now, calledAt: now },
    })
    return res.count
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

  /**
   * The patient's open queue entry at this branch, whatever day it was opened.
   * Deliberately not limited to today: an entry left open overnight still shows
   * in the queue, so the profile must report it too or reception would queue the
   * same patient twice.
   */
  async findActiveForPatient(patientId: string, branchId: string) {
    return prisma.queueEntry.findFirst({
      where: {
        patientId,
        branchId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
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

  async findSessionDetails(queueId: string) {
    return prisma.queueEntry.findUnique({
      where: { id: queueId },
      include: {
        patient: {
          select: {
            id: true,
            patientId: true,
            fullName: true,
            dateOfBirth: true,
            gender: true,
            mobile: true,
            email: true,
            address: true,
            dentalHistories: {
              where: { isLatest: true },
              take: 1,
            },
          },
        },
        doctor: { select: { id: true, name: true } },
        visit: { select: { id: true, visitNo: true, visitType: true, chiefComplaint: true } },
      },
    })
  },
}
