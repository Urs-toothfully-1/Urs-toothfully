import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { patientRepository } from "@/server/repositories/patient.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { EstimateBuilder } from "@/components/estimates/EstimateBuilder"
import { BRAND_COLORS } from "@/lib/constants"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "New Estimate" }

type Props = { searchParams: Promise<{ visitId?: string; patientId?: string }> }

export default async function NewEstimatePage({ searchParams }: Props) {
  const session = await requireRole(["ADMIN", "DOCTOR"])
  const { visitId, patientId } = await searchParams

  if (!visitId || !patientId) redirect("/doctor")

  const [patient, visit, treatments] = await Promise.all([
    patientRepository.findById(patientId),
    visitRepository.findById(visitId),
    treatmentRepository.findAll(),
  ])

  if (!patient || !visit) notFound()

  // Settings + estimate branch follow the VISIT's branch (where the patient is
  // being treated), not the doctor's home branch — doctors rotate across branches.
  const [advPct, allowDisc] = await Promise.all([
    settingsRepository.get("advance_percent", visit.branchId),
    settingsRepository.get("allow_discount", visit.branchId),
  ])

  const advancePercent = parseFloat(advPct ?? "20")
  const allowDiscount = (allowDisc ?? "true") === "true"

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/doctor" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          Queue
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/patients/${patientId}`}
          style={{ color: BRAND_COLORS.primaryTeal }}
          className="hover:underline"
        >
          {patient.fullName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>New Estimate</span>
      </nav>

      {/* Card */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <div className="px-6 py-5">
          <h1 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
            New Treatment Estimate
          </h1>
          <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
            Add treatments, adjust prices, and save the estimate.
          </p>

          <EstimateBuilder
            patientId={patientId}
            visitId={visitId}
            branchId={visit.branchId}
            patientName={patient.fullName}
            visitNo={visit.visitNo}
            doctorName={session.name}
            treatments={(treatments as any[]).map((t) => ({
              id: t.id,
              category: t.category,
              name: t.name,
              defaultAmount: Number(t.defaultAmount),
            }))}
            advancePercent={advancePercent}
            allowDiscount={allowDiscount}
          />
        </div>
      </div>
    </div>
  )
}
