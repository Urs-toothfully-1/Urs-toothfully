import { invoiceService } from "@/server/services/invoice.service"
import { referralService } from "@/server/services/referral.service"
import { getPatientBalance } from "@/server/services/patient-summary.service"
import { CreateInvoiceButton } from "@/components/invoices/CreateInvoiceButton"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Receipt } from "lucide-react"

/** "Bill what you did today" strip — only shown when the patient has a quote-only estimate. */
export async function BillingStrip({ patientId, visitId }: { patientId: string; visitId?: string }) {
  const [estimates, rewards, balance] = await Promise.all([
    invoiceService.billableEstimates(patientId),
    referralService.availableRewards(patientId),
    getPatientBalance(patientId),
  ])
  if (estimates.length === 0) return null

  return (
    <div className="rounded-lg border px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ borderColor: "#E0E3E5", backgroundColor: "white" }}>
      <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
        <Receipt className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> Treatment billing
      </span>
      <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        Due: <strong style={{ color: balance.outstanding > 0 ? "#B91C1C" : BRAND_COLORS.bodyText }}>{formatCurrency(balance.outstanding)}</strong>
      </span>
      {balance.credit > 0 && (
        <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          Advance held: <strong style={{ color: "#065F46" }}>{formatCurrency(balance.credit)}</strong>
        </span>
      )}
      <div className="ml-auto">
        <CreateInvoiceButton patientId={patientId} visitId={visitId} estimates={estimates} rewards={rewards} size="sm" />
      </div>
    </div>
  )
}
