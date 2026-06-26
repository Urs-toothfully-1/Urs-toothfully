import { prisma } from "@/lib/prisma"
import { DentalHistory } from "@prisma/client"

export const dentalHistoryRepository = {
  async findLatestByPatient(patientId: string): Promise<DentalHistory | null> {
    return prisma.dentalHistory.findFirst({
      where: { patientId, isLatest: true },
      include: { createdBy: { select: { id: true, name: true } } },
    })
  },

  async findAllByPatient(patientId: string): Promise<DentalHistory[]> {
    return prisma.dentalHistory.findMany({
      where: { patientId },
      orderBy: { version: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    })
  },

  async create(
    patientId: string,
    createdById: string,
    data: Omit<DentalHistory, "id" | "patientId" | "version" | "isLatest" | "createdById" | "createdAt">
  ): Promise<DentalHistory> {
    // Get current version
    const latest = await prisma.dentalHistory.findFirst({
      where: { patientId, isLatest: true },
      select: { id: true, version: true },
    })

    return prisma.$transaction(async (tx) => {
      // Mark old version as not latest
      if (latest) {
        await tx.dentalHistory.update({
          where: { id: latest.id },
          data: { isLatest: false },
        })
      }

      return tx.dentalHistory.create({
        data: {
          ...data,
          patientId,
          createdById,
          version: (latest?.version ?? 0) + 1,
          isLatest: true,
        },
      })
    })
  },
}
