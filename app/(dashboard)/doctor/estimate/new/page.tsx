import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { patientRepository } from "@/server/repositories/patient.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { estimateRepository } from "@/server/repositories/estimate.repository"
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

  // One estimate per visit — if it already exists, open it instead of a
  // blank builder (clicking "Estimate" twice used to show an empty form).
  const existing = await estimateRepository.findByVisit(visitId)
  if (existing) redirect(`/doctor/estimate/${existing.id}`)

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

      {/* Wizard step indicator */}
      <div className="flex items-center gap-0">
        {[
          { n: 1, label: "Estimate" },
          { n: 2, label: "Prescription" },
          { n: 3, label: "Payment Plan" },
        ].map(({ n, label }, idx) => (
          <div key={n} className="flex items-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ backgroundColor: n === 1 ? `${BRAND_COLORS.primaryTeal}18` : "transparent" }}>
              <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: n === 1 ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderDivider }}>
                {n}
              </span>
              <span className="text-sm font-medium"
                style={{ color: n === 1 ? BRAND_COLORS.primaryTeal : BRAND_COLORS.borderDivider }}>
                {label}
              </span>
            </div>
            {idx < 2 && <ChevronRight className="h-4 w-4 mx-1" style={{ color: BRAND_COLORS.borderDivider }} />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <div className="px-6 py-5">
          <h1 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
            Step 1 — Treatment Estimate
          </h1>
          <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
            Add treatments and adjust prices. Click <strong>Next →</strong> to continue to the prescription.
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
