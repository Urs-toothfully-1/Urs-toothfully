import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { TreatmentsMgmt } from "@/components/admin/TreatmentsMgmt"
import { BRAND_COLORS, TREATMENT_CATEGORIES } from "@/lib/constants"

export const metadata: Metadata = { title: "Treatment Master" }
export const dynamic = "force-dynamic"

export default async function TreatmentsPage() {
  await requireRole(["ADMIN"])
  const treatments = await treatmentRepository.findAll(false)

  // Group by category — serialize Decimal to number before passing to client component
  type PlainTreatment = { id: string; name: string; defaultAmount: number; isActive: boolean }
  const grouped: Record<string, PlainTreatment[]> = {}
  for (const cat of TREATMENT_CATEGORIES) grouped[cat] = []
  for (const t of treatments) {
    if (!grouped[t.category]) grouped[t.category] = []
    grouped[t.category].push({
      id: t.id,
      name: t.name,
      defaultAmount: Number(t.defaultAmount),
      isActive: t.isActive,
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          Treatment Master
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          {treatments.length} treatments across {TREATMENT_CATEGORIES.length} categories
        </p>
      </div>
      <TreatmentsMgmt
        grouped={grouped}
        categories={TREATMENT_CATEGORIES as unknown as string[]}
      />
    </div>
  )
}
