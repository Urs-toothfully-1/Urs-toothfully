import { Metadata } from "next"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { EstimateSummaryCard } from "@/components/estimates/EstimateSummaryCard"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"

export const metadata: Metadata = { title: "Estimates" }

type Props = { params: Promise<{ patientId: string }> }

export default async function EstimatesPage({ params }: Props) {
  const session = await requireSession()
  const { patientId } = await params
  const estimates = await estimateRepository.findByPatient(patientId)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          {estimates.length} estimate{estimates.length !== 1 ? "s" : ""} total
        </p>
        {(session.role === "DOCTOR" || session.role === "ADMIN") && (
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            Create estimates from the doctor queue after starting a consultation.
          </p>
        )}
      </div>

      {estimates.length === 0 ? (
        <Card className="border-[#CCCCCC] bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <FileText className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
            <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              No estimates yet
            </p>
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              Estimates are created by the doctor during a consultation session.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {(estimates as any[]).map((estimate) => (
              <EstimateSummaryCard key={estimate.id} estimate={estimate} />
            ))}
          </div>
          <p className="text-xs pt-1" style={{ color: BRAND_COLORS.borderDivider }}>
            💡 Click the 🖨 icon on any estimate card to open the print/PDF view.
          </p>
        </>
      )}
    </div>
  )
}
