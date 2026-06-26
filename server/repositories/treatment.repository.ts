import { prisma } from "@/lib/prisma"

export const treatmentRepository = {
  async findAll(includeDeleted = false) {
    return prisma.treatmentMaster.findMany({
      where: includeDeleted ? {} : { isDeleted: false, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })
  },

  async findByCategory(category: string) {
    return prisma.treatmentMaster.findMany({
      where: { category, isDeleted: false, isActive: true },
      orderBy: { name: "asc" },
    })
  },

  async findById(id: string) {
    return prisma.treatmentMaster.findUnique({ where: { id } })
  },

  async create(data: {
    category: string
    name: string
    defaultAmount: number
    createdById: string
  }) {
    return prisma.treatmentMaster.create({ data: { ...data, defaultAmount: data.defaultAmount } })
  },

  async update(
    id: string,
    data: Partial<{ category: string; name: string; defaultAmount: number; isActive: boolean }>
  ) {
    return prisma.treatmentMaster.update({ where: { id }, data })
  },

  async softDelete(id: string, deletedById: string, deletionReason: string) {
    await prisma.treatmentMaster.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedById, deletionReason, isActive: false },
    })
  },

  async getCategories(): Promise<string[]> {
    const results = await prisma.treatmentMaster.findMany({
      where: { isDeleted: false },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    })
    return results.map((r) => r.category)
  },
}
