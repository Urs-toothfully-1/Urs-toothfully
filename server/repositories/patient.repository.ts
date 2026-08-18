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

  async getLatestPatientIdForYear(year: number): Promise<string | null> {
    const result = await prisma.patient.findFirst({
      where: { patientId: { startsWith: `PAT-${year}-` } },
      orderBy: { patientId: "desc" },
      select: { patientId: true },
    })
    return result?.patientId ?? null
  },
}

// ── Patient list: staged, filtered, paginated ────────────────────────────────

export const PATIENT_PAGE_SIZE = 25

export type PatientStage = "pre-consultation" | "awaiting-treatment" | "ongoing" | "completed"

export const PATIENT_STAGES: PatientStage[] = [
  "pre-consultation",
  "awaiting-treatment",
  "ongoing",
  "completed",
]

export interface PatientListFilters {
  branchId?: string
  /** Registration date range, inclusive. */
  from?: Date
  to?: Date
}

export interface StagedPatientRow {
  id: string
  patientId: string
  fullName: string
  dateOfBirth: Date
  gender: Gender
  mobile: string
  createdAt: Date
  registrationBranch: { id: string; name: string }
  stage: PatientStage
}

/**
 * Stage is derived once per patient in SQL rather than by fetching every
 * payment and estimate and bucketing in JS. Both the count and the page query
 * share this expression so a patient can never be counted in one stage and
 * listed under another.
 *
 * Dates are bound as ISO strings cast to `timestamp`, not as JS Dates. The
 * column is `timestamp without time zone` holding UTC, and a Date parameter
 * binds as timestamptz — Postgres then shifts it by the session timezone
 * (Asia/Calcutta here), silently returning the wrong day's patients.
 */
function stagedPatients(filters: PatientListFilters) {
  const { branchId, from, to } = filters
  return Prisma.sql`
    SELECT
      p.id, p."patientId", p."fullName", p."dateOfBirth", p.gender, p.mobile, p."createdAt",
      b.id AS "branchId", b.name AS "branchName",
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM "Payment" pay
          WHERE pay."patientId" = p.id AND pay."paymentType" = 'CONSULTATION' AND pay."isDeleted" = false)
          THEN 'pre-consultation'
        WHEN EXISTS (SELECT 1 FROM "Estimate" e
          WHERE e."patientId" = p.id AND e."isDeleted" = false AND e.status IN ('ACTIVE', 'DRAFT'))
          THEN 'ongoing'
        WHEN EXISTS (SELECT 1 FROM "Estimate" e
          WHERE e."patientId" = p.id AND e."isDeleted" = false AND e.status = 'COMPLETED')
          THEN 'completed'
        ELSE 'awaiting-treatment'
      END AS stage
    FROM "Patient" p
    JOIN "Branch" b ON b.id = p."registrationBranchId"
    WHERE p."isDeleted" = false
    ${branchId ? Prisma.sql`AND p."registrationBranchId" = ${branchId}` : Prisma.empty}
    ${from ? Prisma.sql`AND p."createdAt" >= ${from.toISOString()}::timestamp` : Prisma.empty}
    ${to ? Prisma.sql`AND p."createdAt" <= ${to.toISOString()}::timestamp` : Prisma.empty}
  `
}

export const patientListRepository = {
  /** How many patients sit in each stage, for the filter cards. One query. */
  async countByStage(filters: PatientListFilters): Promise<Record<PatientStage, number>> {
    const rows = await prisma.$queryRaw<Array<{ stage: PatientStage; count: bigint }>>(Prisma.sql`
      SELECT stage, COUNT(*) AS count FROM (${stagedPatients(filters)}) staged GROUP BY stage
    `)
    const counts: Record<PatientStage, number> = {
      "pre-consultation": 0,
      "awaiting-treatment": 0,
      ongoing: 0,
      completed: 0,
    }
    for (const r of rows) counts[r.stage] = Number(r.count)
    return counts
  },

  /**
   * One page of patients. `stage` narrows to a single stage; omit it for all.
   * Only PATIENT_PAGE_SIZE rows ever leave the database — the previous version
   * fetched and rendered every patient, which is what made the list crawl.
   *
   * Ordering carries `id` as a tiebreaker because `createdAt` is not unique —
   * bulk-imported patients share a timestamp, and without it the same row can
   * appear on two pages while another is never shown at all.
   */
  async findPage(
    filters: PatientListFilters,
    stage: PatientStage | null,
    page: number
  ): Promise<StagedPatientRow[]> {
    const offset = (Math.max(1, page) - 1) * PATIENT_PAGE_SIZE
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
      stage: PatientStage
    }>>(Prisma.sql`
      SELECT * FROM (${stagedPatients(filters)}) staged
      ${stage ? Prisma.sql`WHERE stage = ${stage}` : Prisma.empty}
      ORDER BY staged."createdAt" DESC, staged.id DESC
      LIMIT ${PATIENT_PAGE_SIZE} OFFSET ${offset}
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
      stage: r.stage,
    }))
  },
}
