import { prisma } from "@/lib/prisma"

export const availabilityRepository = {
  async findAll() {
    return prisma.doctorAvailability.findMany({
      where: { isActive: true },
      include: {
        doctor: { select: { id: true, name: true, doctorRegNo: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ doctor: { name: "asc" } }, { branch: { name: "asc" } }],
    })
  },

  async findByDoctor(doctorId: string) {
    return prisma.doctorAvailability.findMany({
      where: { doctorId, isActive: true },
      include: { branch: { select: { id: true, name: true } } },
    })
  },

  async upsert(data: {
    doctorId: string
    branchId: string
    workingDays: string
    startTime: string
    endTime: string
    effectiveFrom: Date
    effectiveTo?: Date
  }) {
    return prisma.doctorAvailability.upsert({
      where: { doctor_branch_availability: { doctorId: data.doctorId, branchId: data.branchId } },
      update: {
        workingDays: data.workingDays,
        startTime: data.startTime,
        endTime: data.endTime,
        effectiveTo: data.effectiveTo ?? null,
        isActive: true,
      },
      create: { ...data, isActive: true },
    })
  },

  async deactivate(doctorId: string, branchId: string) {
    await prisma.doctorAvailability.updateMany({
      where: { doctorId, branchId },
      data: { isActive: false },
    })
  },
}
