import { Gender } from "@prisma/client"
import { patientRepository } from "@/server/repositories/patient.repository"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"

export const createPatientSchema = z.object({
  registrationBranchId: z.string().min(1),
  fullName: z.string().min(2).max(200),
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

export const patientService = {
  async search(query: string) {
    if (!query || query.trim().length < 2) return []
    return patientRepository.search(query.trim())
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
