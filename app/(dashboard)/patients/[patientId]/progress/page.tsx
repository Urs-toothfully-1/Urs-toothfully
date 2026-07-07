import { Metadata } from "next"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { userRepository } from "@/server/repositories/user.repository"
import { prisma } from "@/lib/prisma"
import { ItemStatusButton } from "@/components/estimates/ItemStatusButton"
import { TreatmentSessionDialog } from "@/components/estimates/TreatmentSessionDialog"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

export const metadata: Metadata = { title: "Treatment Progress" }

type Props = { params: Promise<{ patientId: string }> }

export default async function TreatmentProgressPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params

  const [estimates, patient, doctors] = await Promise.all([
    estimateRepository.findByPatient(patientId),
    prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, registrationBranchId: true } }),
    userRepository.findAllActiveDoctors(),
  ])

  const branchId = patient?.registrationBranchId ?? session.branchId

  const activeEstimates = estimates.filter(
    (e: { status: string; isDeleted: boolean }) => e.status !== "CANCELLED" && !e.isDeleted
  )

  const canUpdate = session.role === "ADMIN" || session.role === "DOCTOR"
  const canStartSession = session.role === "ADMIN" || session.role === "RECEPTIONIST"

  // Compute overall stats
  const allItems = activeEstimates.flatMap((e: any) => e.items ?? [])
  const completed = allItems.filter((i: any) => i.status === "COMPLETED").length
  const total = allItems.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      {total > 0 && (
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                Overall Progress
              </p>
              <p className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
                {completed} / {total} completed ({progressPct}%)
              </p>
            </div>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: progressPct === 100 ? BRAND_COLORS.secondaryGreen : BRAND_COLORS.primaryTeal,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeEstimates.length === 0 ? (
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckCircle className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
            <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              No active treatment plans
            </p>
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              Treatment progress will appear here once an estimate is created.
            </p>
          </CardContent>
        </Card>
      ) : (
        activeEstimates.map((estimate: any) => (
          <Card key={estimate.id} className="border-[#E0E3E5] bg-white">
            <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <CardTitle className="text-sm flex items-center justify-between gap-3 flex-wrap" style={{ color: BRAND_COLORS.bodyText }}>
                <span>{estimate.estimateNo}</span>
                <div className="flex items-center gap-3 text-xs font-normal flex-wrap" style={{ color: BRAND_COLORS.borderDivider }}>
                  <span>{formatDate(estimate.createdAt)}</span>
                  <span>Total: {formatCurrency(Number(estimate.total))}</span>
                  {canStartSession && (estimate.items ?? []).some((i: any) => i.status === "PENDING") && (
                    <TreatmentSessionDialog
                      pendingItems={(estimate.items ?? [])
                        .filter((i: any) => i.status === "PENDING")
                        .map((i: any) => ({ id: i.id, treatmentName: i.treatmentName, toothNumber: i.toothNumber }))}
                      patientId={patientId}
                      branchId={branchId}
                      doctors={(doctors as any[]).map((d) => ({ id: d.id, name: d.name }))}
                    />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-2">
                {(estimate.items ?? []).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: BRAND_COLORS.lightBackground }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: BRAND_COLORS.bodyText }}>
                        {item.treatmentName}
                        {item.toothNumber && (
                          <span className="ml-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                            {item.toothNumber.includes(",") ? "Teeth" : "Tooth"} #{item.toothNumber.split(",").join(", ")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {item.category} · {item.quantity} × {formatCurrency(Number(item.unitRate))} = {formatCurrency(Number(item.amount))}
                      </p>
                      {item.statusUpdatedBy && item.status !== "PENDING" && (
                        <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                          {item.status === "COMPLETED" ? "Completed" : "Started"} by {item.statusUpdatedBy.name}
                          {item.statusUpdatedAt ? ` · ${formatDate(item.statusUpdatedAt)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      {canUpdate ? (
                        <ItemStatusButton
                          itemId={item.id}
                          estimateId={estimate.id}
                          patientId={patientId}
                          currentStatus={item.status}
                        />
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{
                          backgroundColor: item.status === "PENDING" ? "#FEF3C7" : item.status === "IN_PROGRESS" ? "#DBEAFE" : item.status === "COMPLETED" ? "#D1FAE5" : "#F2F4F6",
                          color: item.status === "PENDING" ? "#B45309" : item.status === "IN_PROGRESS" ? "#1D4ED8" : item.status === "COMPLETED" ? "#065F46" : "#707882",
                        }}>
                          {item.status === "PENDING" ? "Pending" : item.status === "IN_PROGRESS" ? "In Progress" : item.status === "COMPLETED" ? "✓ Done" : item.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
