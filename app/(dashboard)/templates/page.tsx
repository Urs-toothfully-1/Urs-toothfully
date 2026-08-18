import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TemplatesManager } from "@/components/templates/TemplatesManager"
import { BRAND_COLORS } from "@/lib/constants"

export const metadata: Metadata = { title: "Templates" }
export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const session = await requireRole(["ADMIN", "DOCTOR"])

  // Archived entries are included so they can be restored from here — the
  // prescription pickers filter them out, this page is where they live.
  const [phrases, medicines, protocols] = await Promise.all([
    prisma.diagnosis.findMany({
      where: { branchId: session.branchId },
      orderBy: [{ specialty: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        specialty: true,
        section: true,
        isActive: true,
        isStandard: true,
      },
    }),
    prisma.medicine.findMany({
      where: { branchId: session.branchId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, isActive: true },
    }),
    prisma.medicineTemplate.findMany({
      where: { branchId: session.branchId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: { medicine: true, frequency: true, duration: true },
        },
      },
    }),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          Templates
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          The lists doctors pick from while writing a prescription. Changes apply to this branch.
        </p>
      </div>

      <TemplatesManager
        phrases={phrases}
        medicines={medicines}
        protocols={protocols.map((p) => ({ ...p, description: p.description ?? "" }))}
      />
    </div>
  )
}
