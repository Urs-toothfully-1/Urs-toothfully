import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { userRepository } from "@/server/repositories/user.repository"
import { prisma } from "@/lib/prisma"
import { UsersMgmt } from "@/components/admin/UsersMgmt"
import { BRAND_COLORS } from "@/lib/constants"

export const metadata: Metadata = { title: "User Management" }
export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const session = await requireRole(["ADMIN"])

  const [users, branches] = await Promise.all([
    userRepository.findAll() as any,
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>User Management</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          {users.length} staff accounts
        </p>
      </div>
      <UsersMgmt users={users} branches={branches} currentUserId={session.userId} />
    </div>
  )
}
