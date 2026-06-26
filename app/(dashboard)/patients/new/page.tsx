import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PatientRegistrationForm } from "@/components/patients/PatientRegistrationForm"
import { BRAND_COLORS } from "@/lib/constants"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "Register New Patient" }

export default async function NewPatientPage() {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/patients" className="hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
          Patients
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>New Patient</span>
      </nav>

      {/* Card */}
      <div className="bg-white rounded-xl border border-[#CCCCCC] overflow-hidden shadow-sm">
        {/* Top accent */}
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />

        <div className="px-8 py-6">
          <h1 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
            Register New Patient
          </h1>
          <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
            Patient will be searchable across all branches after registration.
          </p>

          <PatientRegistrationForm
            branches={branches}
            defaultBranchId={session.branchId}
            isAdmin={session.role === "ADMIN"}
          />
        </div>
      </div>
    </div>
  )
}
