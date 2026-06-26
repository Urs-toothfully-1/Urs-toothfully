import { prisma } from "@/lib/prisma"
import { Role, User } from "@prisma/client"

export type SafeUser = Omit<User, "passwordHash">

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } })
  },

  async findById(id: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({
      where: { id },
      omit: { passwordHash: true },
    })
  },

  async findAllByBranch(branchId: string): Promise<SafeUser[]> {
    return prisma.user.findMany({
      where: { branchId, isActive: true },
      omit: { passwordHash: true },
      orderBy: { name: "asc" },
    })
  },

  async findDoctorsByBranch(branchId: string): Promise<SafeUser[]> {
    return prisma.user.findMany({
      where: { branchId, role: Role.DOCTOR, isActive: true },
      omit: { passwordHash: true },
      orderBy: { name: "asc" },
    })
  },

  async findAllActiveDoctors(): Promise<SafeUser[]> {
    return prisma.user.findMany({
      where: { role: Role.DOCTOR, isActive: true },
      omit: { passwordHash: true },
      orderBy: { name: "asc" },
      include: { branch: { select: { name: true } } },
    })
  },

  async findAll(): Promise<SafeUser[]> {
    return prisma.user.findMany({
      omit: { passwordHash: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { branch: { select: { id: true, name: true } } },
    })
  },

  async incrementLoginAttempts(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { loginAttempts: { increment: 1 } },
    })
  },

  async lockAccount(id: string, until: Date): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lockedUntil: until, loginAttempts: 0 },
    })
  },

  async resetLoginAttempts(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { loginAttempts: 0, lockedUntil: null },
    })
  },

  async create(data: {
    branchId: string
    name: string
    email: string
    passwordHash: string
    role: Role
    doctorRegNo?: string
    doctorQualification?: string
  }): Promise<SafeUser> {
    return prisma.user.create({
      data,
      omit: { passwordHash: true },
    })
  },

  async update(
    id: string,
    data: Partial<{
      name: string
      email: string
      role: Role
      branchId: string
      doctorRegNo: string
      doctorQualification: string
      isActive: boolean
      passwordHash: string
    }>
  ): Promise<SafeUser> {
    return prisma.user.update({
      where: { id },
      data,
      omit: { passwordHash: true },
    })
  },
}
