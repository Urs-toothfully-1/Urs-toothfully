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

  // One query per patient with indexed EXISTS subqueries, instead of shipping every
  // payment + estimate row and bucketing in JS. Returns the same shape the patients
  // page consumes (payments/estimates arrays are synthetic — only their presence and
  // estimate `status` are read by categorize()).
  async findAllWithTreatmentStatus(branchId?: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string
      patientId: string
      fullName: string
      dateOfBirth: Date
      gender: Gender
      mobile: string
      createdAt: Date
      branchId: string
      branchName: string
      hasConsultation: boolean
      hasOngoing: boolean
      hasCompleted: boolean
    }>>(Prisma.sql`
      SELECT
        p.id, p."patientId", p."fullName", p."dateOfBirth", p.gender, p.mobile, p."createdAt",
        b.id AS "branchId", b.name AS "branchName",
        EXISTS (SELECT 1 FROM "Payment" pay
          WHERE pay."patientId" = p.id AND pay."paymentType" = 'CONSULTATION' AND pay."isDeleted" = false) AS "hasConsultation",
        EXISTS (SELECT 1 FROM "Estimate" e
          WHERE e."patientId" = p.id AND e."isDeleted" = false AND e.status IN ('ACTIVE', 'DRAFT')) AS "hasOngoing",
        EXISTS (SELECT 1 FROM "Estimate" e
          WHERE e."patientId" = p.id AND e."isDeleted" = false AND e.status = 'COMPLETED') AS "hasCompleted"
      FROM "Patient" p
      JOIN "Branch" b ON b.id = p."registrationBranchId"
      WHERE p."isDeleted" = false
      ${branchId ? Prisma.sql`AND p."registrationBranchId" = ${branchId}` : Prisma.empty}
      ORDER BY p."createdAt" DESC
    `)

    return rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      fullName: r.fullName,
      dateOfBirth: r.dateOfBirth,
      gender: r.gender,
      mobile: r.mobile,
      createdAt: r.createdAt,
      registrationBranch: { id: r.branchId, name: r.branchName },
      payments: r.hasConsultation ? [{ id: "consultation" }] : [],
      estimates: [
        ...(r.hasOngoing ? [{ status: "ACTIVE" as const }] : []),
        ...(r.hasCompleted ? [{ status: "COMPLETED" as const }] : []),
      ],
    }))
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
