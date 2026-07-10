import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requireRole } from "@/lib/auth"
import { prescriptionService } from "@/server/services/prescription.service"
import { treatmentRepository } from "@/server/repositories/treatment.repository"
import { prisma } from "@/lib/prisma"
import { PrescriptionEditor } from "@/components/prescriptions/PrescriptionEditor"
import { BackButton } from "@/components/shared/BackButton"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

export const metadata: Metadata = { title: "New Prescription" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ visitId?: string }> }

export default async function NewPrescriptionPage({ searchParams }: Props) {
  const session = await requireRole(["ADMIN", "DOCTOR"])
  const { visitId } = await searchParams
  if (!visitId) redirect("/doctor")

  // If this visit already has a prescription, open it instead of making another.
  const existing = await prescriptionService.getByVisit(visitId)
  if (existing) redirect(`/doctor/prescription/${existing.id}`)

  const draft = await prescriptionService.buildDraftForVisit(visitId)
  if (!draft) notFound()

  const [templates, treatments] = await Promise.all([
    prisma.examinationTemplate
      .findMany({ where: { doctorId: session.userId }, orderBy: { name: "asc" }, select: { id: true, name: true, finding: true } })
      .catch(() => []),
    treatmentRepository.findAll(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
          New prescription — nothing is saved until you click Save
        </p>
        <BackButton fallbackHref="/doctor" />
      </div>

      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            New Prescription — {draft.patient?.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <PrescriptionEditor
            prescriptionId=""
            newForVisitId={visitId}
            data={draft}
            canEdit={true}
            initialTemplates={templates}
            treatments={(treatments as any[]).map((t) => ({
              id: t.id, category: t.category, name: t.name, defaultAmount: Number(t.defaultAmount),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
