import Link from "next/link"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Printer } from "lucide-react"

interface Payment {
  id: string
  paymentType: string
  amount: number | string
  mode: string
  transactionRef?: string | null
  paymentDate: Date | string
  collectedBy: { name: string }
  estimate?: { estimateNo: string } | null
  visit?: { visitNo: string } | null
  receipt?: { id: string; receiptNo: string } | null
}

const TYPE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  CONSULTATION: { label: "Consultation", bg: "#DBEAFE", color: "#1D4ED8" },
  TREATMENT: { label: "Treatment", bg: "#D1FAE5", color: "#065F46" },
  ADVANCE: { label: "Advance", bg: "#EDE9FE", color: "#6D28D9" },
  ADJUSTMENT: { label: "Adjustment", bg: "#FEF3C7", color: "#B45309" },
}

const MODE_ICONS: Record<string, string> = {
  CASH: "💵",
  UPI: "📱",
  CARD: "💳",
  BANK_TRANSFER: "🏦",
}

export function PaymentCard({ payment }: { payment: Payment }) {
  const style = TYPE_STYLE[payment.paymentType] ?? TYPE_STYLE.CONSULTATION

  return (
    <div
      className="flex items-start justify-between p-4 rounded-lg border"
      style={{ borderColor: BRAND_COLORS.lightBackground }}
    >
      <div className="flex gap-3">
        {/* Type badge */}
        <div
          className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded h-fit mt-0.5"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {style.label}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: BRAND_COLORS.bodyText }}>
              {formatCurrency(Number(payment.amount))}
            </span>
            <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              {MODE_ICONS[payment.mode]} {payment.mode.replace("_", " ")}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            <span>{formatDate(payment.paymentDate)}</span>
            <span>by {payment.collectedBy.name}</span>
            {payment.estimate && <span>→ {payment.estimate.estimateNo}</span>}
            {payment.visit && !payment.estimate && <span>→ {payment.visit.visitNo}</span>}
            {payment.transactionRef && <span>Ref: {payment.transactionRef}</span>}
          </div>

          {payment.receipt && (
            <p className="text-xs mt-1" style={{ color: BRAND_COLORS.primaryTeal }}>
              Receipt: {payment.receipt.receiptNo}
            </p>
          )}
        </div>
      </div>

      {payment.receipt && (
        <Link
          href={`/print/receipt/${payment.receipt.id}`}
          target="_blank"
          className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 ml-2"
          title="Print Receipt"
        >
          <Printer className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
        </Link>
      )}
    </div>
  )
}
