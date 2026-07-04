import Link from "next/link"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Printer } from "lucide-react"

interface Estimate {
  id: string
  estimateNo: string
  total: number | string
  status: string
  createdAt: Date | string
  doctor: { name: string }
  items: Array<{ treatmentName: string; amount: number | string; status: string }>
  payments?: Array<{ amount: number | string }>
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal },
  COMPLETED: { bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { bg: "#F3F4F6", color: "#6B7280" },
  DRAFT: { bg: "#FEF3C7", color: "#B45309" },
}

export function EstimateSummaryCard({ estimate }: { estimate: Estimate }) {
  const total = Number(estimate.total)
  const paid = (estimate.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)
  const style = STATUS_STYLE[estimate.status] ?? STATUS_STYLE.ACTIVE

  return (
    <Card className="border-[#E0E3E5] bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: BRAND_COLORS.primaryTeal }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                {estimate.estimateNo}
              </p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {formatDate(estimate.createdAt)} · {estimate.doctor.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {estimate.status}
            </span>
            <Link
              href={`/print/estimate/${estimate.id}`}
              target="_blank"
              className="p-1 rounded hover:bg-gray-100"
              title="Print Estimate"
            >
              <Printer className="h-4 w-4" style={{ color: BRAND_COLORS.borderDivider }} />
            </Link>
          </div>
        </div>

        {/* Items summary */}
        <div className="mt-3 space-y-1">
          {estimate.items.slice(0, 3).map((item) => (
            <div key={`${item.treatmentName}-${item.amount}-${item.status}`} className="flex justify-between text-xs">
              <span className="truncate" style={{ color: BRAND_COLORS.borderDivider }}>
                {item.treatmentName}
              </span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(Number(item.amount))}</span>
            </div>
          ))}
          {estimate.items.length > 3 && (
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              +{estimate.items.length - 3} more treatment{estimate.items.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Totals row */}
        <div
          className="mt-3 pt-3 border-t flex items-center justify-between"
          style={{ borderColor: BRAND_COLORS.lightBackground }}
        >
          <div className="flex gap-4 text-xs">
            <span>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Total </span>
              <span className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                {formatCurrency(total)}
              </span>
            </span>
            <span>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Paid </span>
              <span className="font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>
                {formatCurrency(paid)}
              </span>
            </span>
          </div>
          {balance > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}
            >
              Balance {formatCurrency(balance)}
            </span>
          )}
          {balance === 0 && paid > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}
            >
              Paid in Full
            </span>
          )}
        </div>

        <Link
          href={`/doctor/estimate/${estimate.id}`}
          className="mt-2 block text-xs font-medium hover:underline"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          View full estimate →
        </Link>
      </CardContent>
    </Card>
  )
}
