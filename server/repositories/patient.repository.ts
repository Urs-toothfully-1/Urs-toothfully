import { prisma } from "@/lib/prisma"
import { Gender, Patient, Prisma } from "@prisma/client"

export type PatientWithBranch = Patient & {
  registrationBranch: { id: string; name: string }
  createdBy: { id: string; name: string }
}

function searchWhere(q: string, branchId?: string) {
  return {
    isDeleted: false,
    ...(branchId ? { registrationBranchId: branchId } : {}),
    OR: [
      { patientId: { contains: q, mode: "insensitive" as const } },
      { fullName: { contains: q, mode: "insensitive" as const } },
      { mobile: { contains: q } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  }
}

export const SEARCH_PAGE_SIZE = 20

export const patientRepository = {
  async search(query: string, page = 1, branchId?: string): Promise<PatientWithBranch[]> {
    const q = query.trim()
    return prisma.patient.findMany({
      where: searchWhere(q, branchId),
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: SEARCH_PAGE_SIZE,
      skip: (Math.max(1, page) - 1) * SEARCH_PAGE_SIZE,
    })
  },

  async searchCount(query: string, branchId?: string): Promise<number> {
    return prisma.patient.count({ where: searchWhere(query.trim(), branchId) })
  },

  async findById(id: string): Promise<PatientWithBranch | null> {
    return prisma.patient.findUnique({
      where: { id, isDeleted: false },
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  },

  async findByPatientId(patientId: string): Promise<PatientWithBranch | null> {
    return prisma.patient.findUnique({
      where: { patientId, isDeleted: false },
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  },

  async create(data: {
    patientId: string
    registrationBranchId: string
    fullName: string
    dateOfBirth: Date
    gender: Gender
    mobile: string
    email?: string
    address?: string
    leadSource?: string
    referenceName?: string
    reasonForVisit?: string
    createdById: string
  }): Promise<PatientWithBranch> {
    return prisma.patient.create({
      data,
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  },

  async update(
    id: string,
    data: Partial<{
      registrationBranchId: string
      fullName: string
      dateOfBirth: Date
      gender: Gender
      mobile: string
      email: string
      address: string
      leadSource: string
      referenceName: string
      reasonForVisit: string
    }>
  ): Promise<PatientWithBranch> {
    return prisma.patient.update({
      where: { id },
      data,
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  },

  async softDelete(
    id: string,
    deletedById: string,
    deletionReason: string
  ): Promise<void> {
    await prisma.patient.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason },
    })
  },

  async findAllRecent(limit = 100): Promise<PatientWithBranch[]> {
    return prisma.patient.findMany({
      where: { isDeleted: false },
      include: {
        registrationBranch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  },

  async findAllWithTreatmentStatus(branchId?: string) {
    return prisma.patient.findMany({
      where: { isDeleted: false, ...(branchId ? { registrationBranchId: branchId } : {}) },
      select: {
        id: true,
        patientId: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        mobile: true,
        createdAt: true,
        registrationBranch: { select: { id: true, name: true } },
        payments: {
          where: { paymentType: "CONSULTATION", isDeleted: false },
          select: { id: true },
          take: 1,
        },
        estimates: {
          where: { isDeleted: false, status: { not: "CANCELLED" } },
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  },

  async getLatestPatientIdForYear(year: number): Promise<string | null> {
    const result = await prisma.patient.findFirst({
      where: { patientId: { startsWith: `PAT-${year}-` } },
      orderBy: { patientId: "desc" },
      select: { patientId: true },
    })
    return result?.patientId ?? null
  },
}
