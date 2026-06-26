import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDailyRevenue } from "@/lib/reports/daily-revenue"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, CreditCard } from "lucide-react"

export const metadata: Metadata = { title: "Daily Revenue Report" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ date?: string; branch?: string }> }

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank Transfer",
}

export default async function DailyRevenueReportPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const today = new Date().toISOString().split("T")[0]
  const date = sp.date ?? today
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined

  const [branches, data] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    getDailyRevenue(new Date(date), branchId),
  ])

  const paymentTypes = ["CONSULTATION", "TREATMENT", "ADVANCE", "ADJUSTMENT"]
  const modes = ["CASH", "UPI", "CARD", "BANK_TRANSFER"]

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Daily Revenue</span>
      </nav>

      <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>Daily Revenue Report</h1>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Date</label>
          <input type="date" name="date" defaultValue={date} max={today}
            className="h-9 rounded border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Branch</label>
          <select name="branch" defaultValue={sp.branch ?? "all"}
            className="h-9 rounded border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm">
            <option value="all">All Branches</option>
            {branches.map((b: { id: string; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
          View
        </button>
      </form>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Consultation", value: data.consultationTotal, color: "#1D4ED8" },
          { label: "Treatment", value: data.treatmentTotal, color: BRAND_COLORS.secondaryGreen },
          { label: "Advance", value: data.advanceTotal, color: "#6D28D9" },
          { label: "Grand Total", value: data.grandTotal, color: BRAND_COLORS.primaryTeal },
        ].map((s) => (
          <Card key={s.label} className="border-[#CCCCCC] bg-white">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
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
          <Card key={s.label} className="border-[#CCCCCC] bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(s.value)}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown Table */}
      {data.rows.length > 0 ? (
        <Card className="border-[#CCCCCC] bg-white overflow-hidden">
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
        <Card className="border-[#CCCCCC] bg-white">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No revenue recorded for {date}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
