import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDailyRevenue } from "@/lib/reports/daily-revenue"
import { isValidDateStr, istTodayStr } from "@/lib/ist"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, CreditCard } from "lucide-react"

export const metadata: Metadata = { title: "Daily Revenue Report" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ date?: string; branch?: string; basis?: string }> }

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank Transfer",
}

export default async function DailyRevenueReportPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const today = istTodayStr() // the clinic's day, not the server's (UTC) day
  const date = isValidDateStr(sp.date) ? sp.date : today
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined
  const basis = sp.basis === "entry" ? "entry" : "receipt"

  const [branches, data] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    getDailyRevenue(date, branchId, basis),
  ])

  const paymentTypes = ["CONSULTATION", "TREATMENT", "ADVANCE", "ADJUSTMENT", "PRODUCT"]
  const modes = ["CASH", "UPI", "CARD", "BANK_TRANSFER"]

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Daily Revenue</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Daily Revenue Report</h1>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Date</label>
          <input type="date" name="date" defaultValue={date} max={today}
            className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Branch</label>
          <select name="branch" defaultValue={sp.branch ?? "all"}
            className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm">
            <option value="all">All Branches</option>
            {branches.map((b: { id: string; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Count by</label>
          <select name="basis" defaultValue={basis}
            className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm">
            <option value="receipt">Receipt date (books)</option>
            <option value="entry">Entry date (collected today)</option>
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
          View
        </button>
      </form>

      {/* Summary KPIs */}
      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        {basis === "receipt"
          ? "Counting payments by the receipt date written on them (what the books and Tally use)."
          : "Counting payments by the day they were entered — use this to tally the day's cash and card."}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Consultation", value: data.consultationTotal, color: "#1D4ED8" },
          { label: "Treatment", value: data.treatmentTotal, color: BRAND_COLORS.secondaryGreen },
          { label: "Advance", value: data.advanceTotal, color: "#6D28D9" },
          { label: "Products & Services", value: data.productTotal, color: "#C2410C" },
          ...(data.adjustmentTotal ? [{ label: "Adjustments", value: data.adjustmentTotal, color: "#6B7280" }] : []),
          { label: "Grand Total", value: data.grandTotal, color: BRAND_COLORS.primaryTeal },
        ].map((s) => (
          <Card key={s.label} className={`border-[#E0E3E5] bg-white ${s.label === "Grand Total" ? "col-span-2 md:col-span-1" : ""}`}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-semibold tracking-tight" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* By Mode */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Cash", value: data.byCashTotal },
          { label: "UPI", value: data.byUpiTotal },
          { label: "Card", value: data.byCardTotal },
          { label: "Bank Transfer", value: data.byBankTotal },
        ].map((s) => (
          <Card key={s.label} className="border-[#E0E3E5] bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(s.value)}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Why the two views differ for this day */}
      {(data.enteredTodayDatedElsewhere.length > 0 || data.datedTodayEnteredElsewhere.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/40 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Back-dated entries for {date}</CardTitle>
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              These are why the receipt-date and entry-date totals differ. Switch &ldquo;Count by&rdquo; above to see the other view.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ backgroundColor: "#FEF3C7" }}>
                  {["Patient", "Type", "Mode", "Receipt date", "Entered on", "Amount"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: "#92400E" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.enteredTodayDatedElsewhere, ...data.datedTodayEnteredElsewhere].map((e) => (
                  <tr key={e.id} className="border-b border-amber-100">
                    <td className="px-4 py-2" style={{ color: BRAND_COLORS.bodyText }}>
                      {e.patientName} <span className="text-[11px] font-mono" style={{ color: BRAND_COLORS.borderDivider }}>{e.patientId}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{e.paymentType}</td>
                    <td className="px-4 py-2 text-xs">{MODE_LABELS[e.paymentMode]}</td>
                    <td className="px-4 py-2 text-xs" style={{ fontWeight: e.receiptDate === date ? 600 : 400 }}>{e.receiptDate}</td>
                    <td className="px-4 py-2 text-xs" style={{ fontWeight: e.enteredOn === date ? 600 : 400 }}>{e.enteredOn}</td>
                    <td className="px-4 py-2 font-semibold">{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Table */}
      {data.rows.length > 0 ? (
        <Card className="border-[#E0E3E5] bg-white overflow-hidden">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                  {["Payment Type", "Mode", "Count", "Amount"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <td className="px-4 py-2.5" style={{ color: BRAND_COLORS.bodyText }}>{r.paymentType}</td>
                    <td className="px-4 py-2.5" style={{ color: BRAND_COLORS.borderDivider }}>{MODE_LABELS[r.paymentMode]}</td>
                    <td className="px-4 py-2.5" style={{ color: BRAND_COLORS.borderDivider }}>{r.count}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No revenue recorded for {date}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
