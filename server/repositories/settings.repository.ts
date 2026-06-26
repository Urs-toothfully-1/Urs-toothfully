import { prisma } from "@/lib/prisma"

export const settingsRepository = {
  async get(key: string, branchId?: string): Promise<string | null> {
    // Try branch-specific first, then fall back to global
    if (branchId) {
      const branchSetting = await prisma.systemSetting.findUnique({
        where: { branchId_key: { branchId, key } },
      })
      if (branchSetting) return branchSetting.value
    }

    const globalSetting = await prisma.systemSetting.findFirst({
      where: { branchId: null, key },
    })
    return globalSetting?.value ?? null
  },

  async getAll(branchId?: string): Promise<Record<string, string>> {
    const [globalSettings, branchSettings] = await Promise.all([
      prisma.systemSetting.findMany({ where: { branchId: null } }),
      branchId
        ? prisma.systemSetting.findMany({ where: { branchId } })
        : Promise.resolve([]),
    ])

    const merged: Record<string, string> = {}
    for (const s of globalSettings) merged[s.key] = s.value
    // Branch settings override global
    for (const s of branchSettings) merged[s.key] = s.value
    return merged
  },

  async set(key: string, value: string, updatedById: string, branchId?: string): Promise<void> {
    if (branchId) {
      await prisma.systemSetting.upsert({
        where: { branchId_key: { branchId, key } },
        update: { value, updatedById },
        create: { branchId, key, value, updatedById },
      })
    } else {
      const existing = await prisma.systemSetting.findFirst({ where: { branchId: null, key } })
      if (existing) {
        await prisma.systemSetting.update({ where: { id: existing.id }, data: { value, updatedById } })
      } else {
        await prisma.systemSetting.create({ data: { branchId: null, key, value, updatedById } })
      }
    }
  },
}
