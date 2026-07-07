import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { prescriptionService } from "@/server/services/prescription.service"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { ShareActions } from "@/components/share/ShareActions"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, ClipboardList, FileText, Printer } from "lucide-react"

export const metadata: Metadata = { title: "Estimate" }

type Props = { params: Promise<{ estimateId: string }> }

export default async function EstimateDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { estimateId } = await params
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()

  const [paymentAgreement] = await Promise.all([
    paymentAgreementService.getOrSuggest(estimateId),
  ])

  // The prescription is auto-created with the estimate; lazily create it here
  // as a safety net for estimates saved before this feature existed.
  let prescription = await prescriptionService.getByVisit(estimate.visitId)
  if (!prescription) {
    prescription = await prescriptionService
      .createFromEstimate(estimate.id, session.userId)
      .catch(() => null) as typeof prescription
  }

  const total = Number(estimate.total)
  const paid = estimate.payments.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href={`/patients/${estimate.patientId}`} style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          {estimate.patient.fullName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/patients/${estimate.patientId}/estimates`} style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">
          Estimates
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{estimate.estimateNo}</span>
      </nav>

      {/* Estimate Card */}
      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              {estimate.estimateNo}
              <span
                className="text-xs px-2 py-0.5 rounded font-normal"
                style={{
                  backgroundColor: `${BRAND_COLORS.primaryTeal}15`,
                  color: BRAND_COLORS.primaryTeal,
                }}
              >
                {estimate.status}
              </span>
            </CardTitle>
            <div className="flex items-center gap-4">
              {prescription && (
                <Link
                  href={`/doctor/prescription/${prescription.id}`}
                  className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: BRAND_COLORS.primaryTeal }}
                >
                  <ClipboardList className="h-4 w-4" />
                  Prescription
                </Link>
              )}
              <Link
                href={`/print/estimate/${estimate.id}`}
                target="_blank"
                className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: BRAND_COLORS.primaryTeal }}
              >
                <Printer className="h-4 w-4" />
                Print
              </Link>
              <ShareActions
                type="estimate"
                id={estimate.id}
                patientName={estimate.patient.fullName}
                patientMobile={estimate.patient.mobile}
                patientEmail={estimate.patient.email}
                docNo={estimate.estimateNo}
                branchName={estimate.branch.name}
                compact
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
            <span>Date: {formatDate(estimate.createdAt)}</span>
            <span>Doctor: {estimate.doctor.name}</span>
            <span>Branch: {estimate.branch.name}</span>
            {estimate.notes && <span>Notes: {estimate.notes}</span>}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Items */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                  {["#", "Treatment", "Tooth", "Qty", "Rate", "Amount", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 px-2 text-xs font-semibold"
                      style={{ color: BRAND_COLORS.borderDivider }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(estimate.items as any[]).map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-b"
                    style={{ borderColor: BRAND_COLORS.lightBackground }}
                  >
                    <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-2">
                      <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                        {item.treatmentName}
                      </p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {item.category}
                      </p>
                    </td>
                    <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                      {item.toothNumber || "—"}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-center" style={{ color: BRAND_COLORS.bodyText }}>
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                      {formatCurrency(Number(item.unitRate))}
                    </td>
                    <td className="py-2.5 px-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                      {formatCurrency(Number(item.amount))}
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: item.status === "PENDING" ? "#FEF3C7" : item.status === "IN_PROGRESS" ? "#DBEAFE" : item.status === "COMPLETED" ? "#D1FAE5" : "#F2F4F6",
                          color: item.status === "PENDING" ? "#B45309" : item.status === "IN_PROGRESS" ? "#1D4ED8" : item.status === "COMPLETED" ? "#065F46" : "#707882",
                        }}
                      >
                        {item.status === "PENDING" ? "Pending" : item.status === "IN_PROGRESS" ? "In Progress" : item.status === "COMPLETED" ? "✓ Done" : item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div
            className="mt-4 pt-4 border-t space-y-2 max-w-xs ml-auto"
            style={{ borderColor: BRAND_COLORS.lightBackground }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Subtotal</span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(Number(estimate.subtotal))}</span>
            </div>
            {estimate.discountAmount && Number(estimate.discountAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: BRAND_COLORS.borderDivider }}>
                  Discount ({Number(estimate.discountPercent)}%)
                </span>
                <span className="text-red-500">-{formatCurrency(Number(estimate.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span style={{ color: BRAND_COLORS.bodyText }}>Total</span>
              <span style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Paid</span>
              <span style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(paid)}</span>
            </div>
            {balance > 0 && (
              <div className="flex justify-between text-sm font-bold pt-1 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                <span style={{ color: "#C2410C" }}>Balance Due</span>
                <span style={{ color: "#C2410C" }}>{formatCurrency(balance)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Advance Required</span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(Number(estimate.advanceRequired))}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
