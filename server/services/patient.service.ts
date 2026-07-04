import { Gender } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { patientRepository } from "@/server/repositories/patient.repository"
import { createAuditLog } from "@/lib/audit"
import type { DentalHistoryData } from "@/lib/dental-history-form"
import { z } from "zod"

export const createPatientSchema = z.object({
  registrationBranchId: z.string().min(1),
  fullName: z.string().min(2).max(200).regex(/^[^<>]+$/, "Name contains invalid characters"),
  dateOfBirth: z.string().date(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  mobile: z.string().min(10).max(15).regex(/^\d+$/, "Mobile must be digits only"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  leadSource: z.string().max(100).optional(),
  referenceName: z.string().max(200).optional(),
  reasonForVisit: z.string().max(1000).optional(),
})

export type CreatePatientInput = z.infer<typeof createPatientSchema>

async function generateNextPatientId(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await patientRepository.getLatestPatientIdForYear(year)
  const next = latest ? parseInt(latest.split("-")[2]) + 1 : 1
  return `PAT-${year}-${String(next).padStart(5, "0")}`
}

export interface DuplicateCheckResult {
  /** Exact mobile match — registration must not proceed; open existing profile */
  mobileMatch: { id: string; patientId: string; fullName: string; mobile: string } | null
  /** Same name + DOB — possible duplicate; receptionist decides */
  nameDobMatches: Array<{ id: string; patientId: string; fullName: string; mobile: string }>
}

export const patientService = {
  async search(query: string) {
    if (!query || query.trim().length < 2) return []
    return patientRepository.search(query.trim())
  },

  /** Duplicate detection for staff registration: mobile, then name + DOB. */
  async findDuplicates(input: {
    mobile: string
    fullName: string
    dateOfBirth: string
    email?: string
  }): Promise<DuplicateCheckResult> {
    const select = { id: true, patientId: true, fullName: true, mobile: true }

    const [mobileMatch, nameDobMatches] = await Promise.all([
      // Mobile is a hard block — never create a second patient on the same number
      prisma.patient.findFirst({
        where: { isDeleted: false, mobile: input.mobile.trim() },
        select,
      }),
      // Name + DOB (or same email) is a soft warning — receptionist decides
      prisma.patient.findMany({
        where: {
          isDeleted: false,
          OR: [
            {
              fullName: { equals: input.fullName.trim(), mode: "insensitive" },
              dateOfBirth: new Date(input.dateOfBirth),
            },
            ...(input.email ? [{ email: { equals: input.email.trim(), mode: "insensitive" as const } }] : []),
          ],
        },
        select,
        take: 5,
      }),
    ])

    return { mobileMatch, nameDobMatches }
  },

  async getById(id: string) {
    return patientRepository.findById(id)
  },

  async create(input: CreatePatientInput, createdById: string) {
    const patientId = await generateNextPatientId()

    const patient = await patientRepository.create({
      patientId,
      registrationBranchId: input.registrationBranchId,
      fullName: input.fullName.trim(),
      dateOfBirth: new Date(input.dateOfBirth),
      gender: input.gender as Gender,
      mobile: input.mobile.trim(),
      email: input.email || undefined,
      address: input.address || undefined,
      leadSource: input.leadSource || undefined,
      referenceName: input.referenceName || undefined,
      reasonForVisit: input.reasonForVisit || undefined,
      createdById,
    })

    await createAuditLog({
      entityType: "Patient",
      entityId: patient.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { patientId, fullName: patient.fullName },
      branchId: input.registrationBranchId,
    })

    return patient
  },

  /** Registers a patient and their dental history v1 in a single transaction. */
  async createWithHistory(
    input: CreatePatientInput,
    history: DentalHistoryData,
    createdById: string
  ) {
    const patientId = await generateNextPatientId()

    const patient = await prisma.$transaction(async (tx) => {
      const p = await tx.patient.create({
        data: {
          patientId,
          registrationBranchId: input.registrationBranchId,
          fullName: input.fullName.trim(),
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender as Gender,
          mobile: input.mobile.trim(),
          email: input.email || undefined,
          address: input.address || undefined,
          leadSource: input.leadSource || undefined,
          referenceName: input.referenceName || undefined,
          reasonForVisit: input.reasonForVisit || undefined,
          createdById,
        },
      })

      await tx.dentalHistory.create({
        data: {
          ...history,
          patientId: p.id,
          createdById,
          version: 1,
          isLatest: true,
        },
      })

      return p
    })

    await createAuditLog({
      entityType: "Patient",
      entityId: patient.id,
      action: "CREATE",
      changedById: createdById,
      newValues: { patientId, fullName: patient.fullName, withDentalHistory: true },
      branchId: input.registrationBranchId,
    })

    return patient
  },

  async update(id: string, input: Partial<CreatePatientInput>, updatedById: string) {
    const before = await patientRepository.findById(id)
    if (!before) throw new Error("Patient not found")

    const patient = await patientRepository.update(id, {
      ...(input.fullName && { fullName: input.fullName.trim() }),
      ...(input.dateOfBirth && { dateOfBirth: new Date(input.dateOfBirth) }),
      ...(input.gender && { gender: input.gender as Gender }),
      ...(input.mobile && { mobile: input.mobile.trim() }),
      ...(input.email !== undefined && { email: input.email || undefined }),
      ...(input.address !== undefined && { address: input.address || undefined }),
      ...(input.leadSource !== undefined && { leadSource: input.leadSource || undefined }),
      ...(input.referenceName !== undefined && { referenceName: input.referenceName || undefined }),
      ...(input.reasonForVisit !== undefined && { reasonForVisit: input.reasonForVisit || undefined }),
    })

    await createAuditLog({
      entityType: "Patient",
      entityId: id,
      action: "UPDATE",
      changedById: updatedById,
      previousValues: { fullName: before.fullName, mobile: before.mobile },
      newValues: { fullName: patient.fullName, mobile: patient.mobile },
    })

    return patient
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    const patient = await patientRepository.findById(id)
    if (!patient) throw new Error("Patient not found")

    await patientRepository.softDelete(id, deletedById, deletionReason)

    await createAuditLog({
      entityType: "Patient",
      entityId: id,
      action: "DELETE",
      changedById: deletedById,
      previousValues: { patientId: patient.patientId, fullName: patient.fullName },
      reason: deletionReason,
    })
  },
}
