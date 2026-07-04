import { Metadata } from "next"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { paymentRepository } from "@/server/repositories/payment.repository"
import { PaymentCard } from "@/components/payments/PaymentCard"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, PlusCircle } from "lucide-react"

export const metadata: Metadata = { title: "Payments" }

type Props = { params: Promise<{ patientId: string }> }

export default async function PaymentsPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params
  const payments = await paymentRepository.findByPatient(patientId)

  type P = { paymentType: string; isDeleted: boolean; amount: unknown }
  const consultation = payments
    .filter((p: P) => p.paymentType === "CONSULTATION" && !p.isDeleted)
    .reduce((s: number, p: P) => s + Number(p.amount), 0)

  const treatment = payments
    .filter((p: P) => ["TREATMENT", "ADVANCE"].includes(p.paymentType) && !p.isDeleted)
    .reduce((s: number, p: P) => s + Number(p.amount), 0)

  const total = consultation + treatment
  const canCollect = session.role === "RECEPTIONIST" || session.role === "ADMIN"

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
