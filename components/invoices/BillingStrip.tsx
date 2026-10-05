import { invoiceService } from "@/server/services/invoice.service"
import { rewardService } from "@/server/services/reward.service"
import { getPatientBalance } from "@/server/services/patient-summary.service"
import { CreateInvoiceButton } from "@/components/invoices/CreateInvoiceButton"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Receipt } from "lucide-react"

/** "Bill what you did today" strip — only shown when the patient has a quote-only estimate. */
export async function BillingStrip({ patientId, visitId }: { patientId: string; visitId?: string }) {
  const [estimates, rewards, balance] = await Promise.all([
    invoiceService.billableEstimates(patientId),
    rewardService.availableDiscounts(patientId),
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
      {balance.dueFromOlderEstimates.length > 0 && (
        <span className="text-xs w-full md:w-auto" style={{ color: BRAND_COLORS.borderDivider }}>
          {formatCurrency(balance.dueFromOlderEstimates.reduce((s, e) => s + e.due, 0))} from older estimate
          {balance.dueFromOlderEstimates.length > 1 ? "s" : ""}{" "}
          {balance.dueFromOlderEstimates.map((e) => e.estimateNo.replace(/^EST-\d{4}-/, "EST-")).join(" / ")}
          {" · "}
          {formatCurrency(balance.dueFromInvoices)} from invoices
        </span>
      )}
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
