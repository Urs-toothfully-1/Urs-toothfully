import { Metadata } from "next"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { visitRepository } from "@/server/repositories/visit.repository"
import { BRAND_COLORS } from "@/lib/constants"
import { VISIT_TYPE_LABELS } from "@/lib/queue-helpers"
import { formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "lucide-react"

export const metadata: Metadata = { title: "Visit History" }

type Props = { params: Promise<{ patientId: string }> }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  IN_PROGRESS: { bg: "#FEF9C3", color: "#854D0E" },
  COMPLETED: { bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { bg: "#F3F4F6", color: "#6B7280" },
  NO_SHOW: { bg: "#FEE2E2", color: "#B91C1C" },
}

export default async function VisitHistoryPage({ params }: Props) {
  await requireSession()
  const { patientId } = await params
  const visits = await visitRepository.findByPatient(patientId)

  return (
    <Card className="border-[#CCCCCC] bg-white">
      <CardContent className="pt-5">
        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Calendar className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
            <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>No visits yet</p>
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              Use &quot;Add to Queue&quot; from the Overview tab to create a visit.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs mb-4" style={{ color: BRAND_COLORS.borderDivider }}>
              {visits.length} visit{visits.length !== 1 ? "s" : ""} across all branches
            </p>
            {visits.map((v: any) => {
              const style = STATUS_STYLE[v.status] ?? STATUS_STYLE.COMPLETED
              return (
                <div
                  key={v.id}
                  className="flex items-start justify-between p-4 rounded-lg border"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}
                >
                  <div className="flex gap-4">
                    {/* Date block */}
                    <div
                      className="flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-center"
                      style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15` }}
                    >
                      <p className="text-lg font-bold leading-none" style={{ color: BRAND_COLORS.primaryTeal }}>
                        {new Date(v.visitDate).getDate()}
                      </p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                        {new Date(v.visitDate).toLocaleDateString("en-IN", { month: "short" })}
                      </p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {new Date(v.visitDate).getFullYear()}
                      </p>
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                          {v.visitNo}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: style.bg, color: style.color }}
                        >
                          {v.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                        {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType} · {v.branch?.name ?? "—"} Branch
                      </p>
                      {v.doctor && (
                        <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                          Dr. {v.doctor.name.replace("Dr. ", "")}
                        </p>
                      )}
                      {v.chiefComplaint && (
                        <p className="text-xs mt-1 italic" style={{ color: BRAND_COLORS.borderDivider }}>
                          &quot;{v.chiefComplaint}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Estimates count */}
                  {v.estimates && v.estimates.length > 0 && (
                    <div className="text-right flex-shrink-0">
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
                      >
                        {v.estimates.length} estimate{v.estimates.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
