import { prisma } from "@/lib/prisma"
import { diagnosisRepository, type PhraseSection } from "@/server/repositories/diagnosis.repository"
import { createAuditLog } from "@/lib/audit"

export const diagnosisService = {
  /**
   * Saves a phrase the doctor typed themselves so it can be reused. Returns the
   * existing row when the wording already exists — creating is idempotent, so a
   * double-click cannot produce two library entries.
   */
  async createCustomDiagnosis(
    branchId: string,
    name: string,
    specialty: string,
    createdBy: string,
    section: PhraseSection = "DIAGNOSIS"
  ) {
    const existing = await diagnosisRepository.findByName(branchId, section, name)
    if (existing) return existing

    const diagnosis = await diagnosisRepository.create({
      branchId,
      name,
      specialty,
      section,
      isStandard: false,
      createdBy,
    })

    await createAuditLog({
      entityType: "Diagnosis",
      entityId: diagnosis.id,
      action: "CREATE",
      changedById: createdBy,
      newValues: { name, specialty, section },
      branchId,
    })

    return diagnosis
  },

  async trackDiagnosisUsage(doctorId: string, diagnosisId: string, branchId: string) {
    await prisma.diagnosisUsage.upsert({
      where: { doctorId_diagnosisId: { doctorId, diagnosisId } },
      create: { doctorId, diagnosisId, branchId },
      update: { usedAt: new Date() },
    })
  },

  async getLibrary(branchId: string, section: PhraseSection) {
    return diagnosisRepository.findBySection(branchId, section)
  },

  async getRecentDiagnoses(doctorId: string, branchId: string, section: PhraseSection = "DIAGNOSIS") {
    return diagnosisRepository.findRecent(doctorId, branchId, section)
  },

  async getMyDiagnoses(branchId: string, section: PhraseSection = "DIAGNOSIS") {
    return diagnosisRepository.findMyDiagnoses(branchId, section)
  },

  async getStandardDiagnoses(branchId: string) {
    return diagnosisRepository.findStandard(branchId)
  },

  async getDiagnosesBySpecialty(branchId: string, specialty: string, section: PhraseSection = "DIAGNOSIS") {
    return diagnosisRepository.findByBranchAndSpecialty(branchId, specialty, section)
  },

  async searchDiagnoses(branchId: string, query: string, section: PhraseSection = "DIAGNOSIS") {
    return diagnosisRepository.search(branchId, query, section)
  },
}
