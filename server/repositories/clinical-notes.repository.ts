import { prisma } from "@/lib/prisma"

export const clinicalNotesRepository = {
  async findByPatient(patientId: string) {
    return prisma.clinicalNote.findMany({
      where: { patientId },
      include: {
        doctor: { select: { id: true, name: true } },
        visit: { select: { id: true, visitNo: true, visitDate: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  },

  async findByVisit(visitId: string) {
    return prisma.clinicalNote.findMany({
      where: { visitId },
      include: {
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })
  },

  async create(data: {
    patientId: string
    visitId: string
    doctorId: string
    noteType: string
    content: string
  }) {
    return prisma.clinicalNote.create({
      data,
      include: {
        doctor: { select: { id: true, name: true } },
      },
    })
  },
}
