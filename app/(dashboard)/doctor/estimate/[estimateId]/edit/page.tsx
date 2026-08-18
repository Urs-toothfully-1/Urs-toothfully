import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { EstimateBuilder } from "@/components/estimates/EstimateBuilder"
import { BackButton } from "@/components/shared/BackButton"
import { BRAND_COLORS } from "@/lib/constants"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Edit Estimate" }

type Props = {
  params: Promise<{ estimateId: string }>
  searchParams: Promise<{ return?: string }>
}

export default async function EditEstimatePage({ params, searchParams }: Props) {
  const session = await requireRole(["ADMIN", "DOCTOR"])
  const { estimateId } = await params
  const { return: rawReturn } = await searchParams
  // Only accept internal absolute paths — never an off-site or protocol-relative URL.
  const returnHref = rawReturn?.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : undefined

  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()

  const [treatments, visit] = await Promise.all([
    treatmentRepository.findAll(),
    visitRepository.findById(estimate.visitId),
  ])

  if (!visit) notFound()

  const allowDisc = await settingsRepository.get("allow_discount", estimate.branchId)

  const allowDiscount = (allowDisc ?? "true") === "true"

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back + Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          <Link href="/doctor" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
            Queue
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/doctor/estimate/${estimateId}/wizard`}
            style={{ color: BRAND_COLORS.primaryTeal }}
            className="hover:underline"
          >
            {estimate.estimateNo}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Edit</span>
        </nav>
        <BackButton fallbackHref={`/patients/${estimate.patientId}`} />
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <div className="px-6 py-5">
          <h1 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
            Edit Estimate — {estimate.estimateNo}
          </h1>
          <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
            Update treatments and prices. Click <strong>Save Changes →</strong> to return to the wizard.
          </p>

          <EstimateBuilder
            patientId={estimate.patientId}
            visitId={estimate.visitId}
            branchId={estimate.branchId}
            patientName={estimate.patient.fullName}
            visitNo={(visit as any).visitNo}
            doctorName={session.name}
            treatments={(treatments as any[]).map((t) => ({
              id: t.id,
              category: t.category,
              name: t.name,
              defaultAmount: Number(t.defaultAmount),
            }))}
            allowDiscount={allowDiscount}
            estimateId={estimateId}
            initialItems={(estimate.items as any[]).map((i) => ({
              id: i.id,
              treatmentId: i.treatmentId ?? "",
              treatmentName: i.treatmentName,
              category: i.category,
              toothNumber: i.toothNumber ?? "",
              quantity: i.quantity,
              unitRate: Number(i.unitRate),
              plannedSittings: i.plannedSittings ?? 1,
            }))}
            initialNotes={estimate.notes ?? ""}
            initialDiscountPercent={estimate.discountPercent ? Number(estimate.discountPercent) : 0}
            returnHref={returnHref}
          />
        </div>
      </div>
    </div>
  )
}
