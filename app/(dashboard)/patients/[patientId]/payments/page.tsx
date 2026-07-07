import { Metadata } from "next"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { PaymentCard } from "@/components/payments/PaymentCard"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock, CheckCircle2, CreditCard, PlusCircle } from "lucide-react"

export const metadata: Metadata = { title: "Payments" }

type Props = { params: Promise<{ patientId: string }> }

export default async function PaymentsPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params

  const [payments, estimates] = await Promise.all([
    paymentRepository.findByPatient(patientId),
    estimateRepository.findByPatient(patientId),
  ])

  // Fetch payment schedule for each active estimate (saved or auto-suggested)
  const activeEstimates = (estimates as any[]).filter((e) => e.status === "ACTIVE" && !e.isDeleted)
  const agreementResults = await Promise.all(
    activeEstimates.map((e: any) => paymentAgreementService.getOrSuggest(e.id))
  )
  const agreementByEstimate = Object.fromEntries(
    activeEstimates.map((e: any, i: number) => [e.id, agreementResults[i]])
  )

  type P = { paymentType: string; isDeleted: boolean; amount: unknown }
  const consultation = payments
    .filter((p: P) => p.paymentType === "CONSULTATION" && !p.isDeleted)
    .reduce((s: number, p: P) => s + Number(p.amount), 0)

  const treatment = payments
    .filter((p: P) => ["TREATMENT", "ADVANCE"].includes(p.paymentType) && !p.isDeleted)
    .reduce((s: number, p: P) => s + Number(p.amount), 0)

  const total = consultation + treatment
  const canCollect = session.role === "RECEPTIONIST" || session.role === "ADMIN"

  // Estimates with agreements that have at least one pending stage
  const estimatesWithSchedule = activeEstimates
    .map((e: any) => {
      const agreement = agreementByEstimate[e.id]
      if (!agreement) return null
      const stages = agreement.stages as any[]
      return {
        id: e.id,
        estimateNo: e.estimateNo,
        total: Number(e.total),
        stages,
        pendingCount: stages.filter((s: any) => !s.received).length,
        receivedTotal: stages.filter((s: any) => s.received).reduce((sum: number, s: any) => sum + s.amount, 0),
        scheduledTotal: stages.reduce((sum: number, s: any) => sum + s.amount, 0),
      }
    })
    .filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Consultation Fees", value: consultation, color: "#1D4ED8" },
          { label: "Treatment Paid", value: treatment, color: BRAND_COLORS.secondaryGreen },
          { label: "Total Collected", value: total, color: BRAND_COLORS.primaryTeal },
        ].map((s) => (
          <Card key={s.label} className="border-[#E0E3E5] bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold" style={{ color: s.color }}>
                {formatCurrency(s.value)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {s.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collect Payment CTA */}
      {canCollect && (
        <div className="flex justify-end">
          <Link
            href={`/reception/collect-payment?patientId=${patientId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            <PlusCircle className="h-4 w-4" />
            Collect Payment
          </Link>
        </div>
      )}

      {/* Payment Agreement Schedule */}
      {estimatesWithSchedule.length > 0 && (
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <CalendarClock className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {estimatesWithSchedule.map((est: any) => (
              <div key={est.id}>
                {/* Estimate header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                      {est.estimateNo}
                    </span>
                    {est.pendingCount > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                        {est.pendingCount} pending
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                        All received
                      </span>
                    )}
                  </div>
                  <div className="text-xs space-x-3" style={{ color: BRAND_COLORS.borderDivider }}>
                    <span>Scheduled: <strong style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(est.scheduledTotal)}</strong></span>
                    <span>Received: <strong style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(est.receivedTotal)}</strong></span>
                    {est.scheduledTotal > est.receivedTotal && (
                      <span>Due: <strong style={{ color: "#C2410C" }}>{formatCurrency(est.scheduledTotal - est.receivedTotal)}</strong></span>
                    )}
                  </div>
                </div>

                {/* Stages */}
                <div className="rounded-xl border border-[#E0E3E5] divide-y divide-[#F2F4F6] overflow-hidden">
                  {est.stages.map((stage: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3"
                      style={{ backgroundColor: stage.received ? "#F0FDF4" : "white" }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                          {stage.name}
                        </p>
                        {stage.dueDate && (
                          <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                            Due:{" "}
                            {new Date(stage.dueDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                          {formatCurrency(stage.amount)}
                        </span>
                        {stage.received ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />Received
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                              Pending
                            </span>
                            {canCollect && (
                              <Link
                                href={`/reception/collect-payment?patientId=${patientId}&estimateId=${est.id}`}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white"
                                style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
                              >
                                Collect
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <CreditCard className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Payment History
            {payments.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-normal"
                style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
              >
                {payments.length} record{payments.length !== 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CreditCard className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                No payments recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(payments as any[]).map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={{
                    ...payment,
                    amount: Number(payment.amount),
                    collectedBy: (payment as any).collectedBy ?? { name: "—" },
                    estimate: (payment as any).estimate,
                    visit: (payment as any).visit,
                    receipt: (payment as any).receipt,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
