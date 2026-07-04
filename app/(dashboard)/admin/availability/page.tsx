import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { availabilityRepository } from "@/server/repositories/availability.repository"
import { userRepository } from "@/server/repositories/user.repository"
import { prisma } from "@/lib/prisma"
import { AvailabilityMgmt } from "@/components/admin/AvailabilityMgmt"
import { BRAND_COLORS } from "@/lib/constants"

export const metadata: Metadata = { title: "Doctor Availability" }
export const dynamic = "force-dynamic"

export default async function AvailabilityPage() {
  await requireRole(["ADMIN"])

  const [doctors, branches, schedules] = await Promise.all([
    userRepository.findAll().then((users: any[]) => users.filter((u: any) => u.role === "DOCTOR")),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    availabilityRepository.findAll(),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Doctor Availability</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Working days and hours per doctor per branch
        </p>
      </div>
      <AvailabilityMgmt doctors={doctors as any} branches={branches} schedules={schedules as any} />
    </div>
  )
}
