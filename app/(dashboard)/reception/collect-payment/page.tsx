import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { patientRepository } from "@/server/repositories/patient.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { prisma } from "@/lib/prisma"
import { ConsultationFeeForm } from "@/components/payments/ConsultationFeeForm"
import { TreatmentPaymentForm } from "@/components/payments/TreatmentPaymentForm"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, CreditCard, Receipt } from "lucide-react"

export const metadata: Metadata = { title: "Collect Payment" }

type Props = { searchParams: Promise<{ patientId?: string; visitId?: string; estimateId?: string }> }

export default async function CollectPaymentPage({ searchParams }: Props) {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  const { patientId, visitId, estimateId } = await searchParams

  if (!patientId) {
    // No patient selected — redirect to search
    redirect("/patients")
  }

  const patient = await patientRepository.findById(patientId)
  if (!patient) notFound()

  const [consultationFee, estimates, visits, existingConsultationPayment] = await Promise.all([
    settingsRepository.get("consultation_fee", session.branchId),
    estimateRepository.findActiveByPatient(patientId),
    visitRepository.findByPatient(patientId),
    prisma.payment.findFirst({
      where: { patientId, paymentType: "CONSULTATION", isDeleted: false },
      select: { id: true },
    }),
  ])

  const defaultFee = parseFloat(consultationFee ?? "1000")

  // Calculate outstanding balance per estimate
  const estimatesWithBalance = await Promise.all(
    estimates.map(async (e: any) => {
      const balance = await paymentRepository.findByEstimate(e.id).then((payments) => {
        const paid = payments.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount), 0)
        return Math.max(0, Number(e.total) - paid)
      })
      return {
        id: e.id,
        estimateNo: e.estimateNo,
        total: Number(e.total),
        paid: Number(e.total) - balance,
        balance,
      }
    })
  )

  const activeEstimates = estimatesWithBalance.filter((e) => e.balance > 0.01)

  // Most recent visit with IN_PROGRESS status (for consultation fee)
  const activeVisit = visits.find(
    (v: any) => v.status === "IN_PROGRESS" && (!visitId || v.id === visitId)
  ) as any

  const preselectedVisit = visitId
    ? (visits.find((v: any) => v.id === visitId) as any)
    : activeVisit

  const preselectedEstimate = estimateId
    ? activeEstimates.find((e) => e.id === estimateId)
    : undefined

  // Show consultation fee form if:
  // (a) there is an active visit (mid-visit collection), OR
  // (b) fee has never been paid (pre-queue — new patient flow)
  const hasPaidConsultation = !!existingConsultationPayment
  const showPreQueueConsultation = !hasPaidConsultation && !preselectedVisit
  const showConsultation = !!preselectedVisit || showPreQueueConsultation
  const showTreatment = activeEstimates.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/reception" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          Reception
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/patients/${patientId}`} style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          {patient.fullName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Collect Payment</span>
      </nav>

      {/* Patient banner */}
      <div
        className="rounded-lg p-4 flex items-center justify-between"
        style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}10`, border: `1px solid ${BRAND_COLORS.primaryTeal}30` }}
      >
        <div>
          <p className="font-bold" style={{ color: BRAND_COLORS.bodyText }}>{patient.fullName}</p>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {patient.patientId} · {patient.mobile}
          </p>
        </div>
        <CreditCard className="h-6 w-6" style={{ color: BRAND_COLORS.primaryTeal }} />
      </div>

      {/* Consultation Fee section */}
      {showConsultation && (
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Receipt className="h-4 w-4" style={{ color: "#1D4ED8" }} />
              Consultation Fee
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <ConsultationFeeForm
              visitId={preselectedVisit?.id}
              visitNo={preselectedVisit?.visitNo}
              patientId={patientId}
              branchId={session.branchId}
              defaultFee={defaultFee}
            />
          </CardContent>
        </Card>
      )}

      {/* Treatment / Advance section */}
      {showTreatment && (
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <CreditCard className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Treatment / Advance Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <TreatmentPaymentForm
              patientId={patientId}
              branchId={session.branchId}
              estimates={preselectedEstimate ? [preselectedEstimate, ...activeEstimates.filter((e) => e.id !== preselectedEstimate.id)] : activeEstimates}
            />
          </CardContent>
        </Card>
      )}

      {/* No payment options */}
      {!showConsultation && !showTreatment && (
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <CreditCard className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
            <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>No pending payments</p>
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              Consultation fee is already collected and there are no outstanding treatment balances.
            </p>
            <Link href={`/patients/${patientId}`} className="text-sm font-medium" style={{ color: BRAND_COLORS.primaryTeal }}>
              Go to Patient Profile →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
