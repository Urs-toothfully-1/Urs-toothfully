import { prisma } from "@/lib/prisma"
import type { Diagnosis } from "@prisma/client"

/** Which part of the prescription a phrase belongs to. */
export type PhraseSection = "DIAGNOSIS" | "COMPLAINT"

export const diagnosisRepository = {
  async findById(id: string): Promise<Diagnosis | null> {
    return prisma.diagnosis.findUnique({ where: { id } })
  },

  /**
   * The whole library for one section, ordered for grouped display. The list is
   * a few hundred rows at most, so the picker loads it once and filters in the
   * browser rather than round-tripping on every keystroke.
   */
  async findBySection(branchId: string, section: PhraseSection): Promise<Diagnosis[]> {
    return prisma.diagnosis.findMany({
      where: { branchId, section, isActive: true },
      orderBy: [{ specialty: "asc" }, { name: "asc" }],
    })
  },

  async findByBranchAndSpecialty(
    branchId: string,
    specialty: string,
    section: PhraseSection = "DIAGNOSIS"
  ): Promise<Diagnosis[]> {
    return prisma.diagnosis.findMany({
      where: { branchId, specialty, section, isActive: true },
      orderBy: { name: "asc" },
    })
  },

  /** Free-text search across every specialty in the branch. */
  async search(
    branchId: string,
    query: string,
    section: PhraseSection = "DIAGNOSIS",
    limit = 50
  ): Promise<Diagnosis[]> {
    return prisma.diagnosis.findMany({
      where: {
        branchId,
        section,
        isActive: true,
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: limit,
    })
  },

  async findRecent(
    doctorId: string,
    branchId: string,
    section: PhraseSection = "DIAGNOSIS",
    limit = 8
  ): Promise<Diagnosis[]> {
    const usage = await prisma.diagnosisUsage.findMany({
      where: { doctorId, branchId, diagnosis: { section, isActive: true } },
      include: { diagnosis: true },
      orderBy: { usedAt: "desc" },
      take: limit,
    })
    return usage.map((u) => u.diagnosis)
  },

  async findMyDiagnoses(
    branchId: string,
    section: PhraseSection = "DIAGNOSIS"
  ): Promise<Diagnosis[]> {
    return prisma.diagnosis.findMany({
      where: { branchId, section, isStandard: false, isActive: true },
      orderBy: { createdAt: "desc" },
    })
  },

  async create(data: {
    branchId: string
    name: string
    specialty: string
    section?: PhraseSection
    isStandard?: boolean
    createdBy?: string
  }): Promise<Diagnosis> {
    return prisma.diagnosis.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        specialty: data.specialty,
        section: data.section ?? "DIAGNOSIS",
        isStandard: data.isStandard ?? false,
        createdBy: data.createdBy,
      },
    })
  },

  async findByName(
    branchId: string,
    section: PhraseSection,
    name: string
  ): Promise<Diagnosis | null> {
    return prisma.diagnosis.findUnique({
      where: { branchId_section_name: { branchId, section, name } },
    })
  },

  async findStandard(branchId: string): Promise<Diagnosis[]> {
    return prisma.diagnosis.findMany({
      where: { branchId, section: "DIAGNOSIS", isStandard: true, isActive: true },
      orderBy: [{ specialty: "asc" }, { name: "asc" }],
    })
  },
}
