import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMonthlyRevenue } from "@/lib/reports/monthly-revenue"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Monthly Revenue Report" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ year?: string; month?: string; branch?: string }> }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export default async function MonthlyRevenueReportPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const now = new Date()
  const year = parseInt(sp.year ?? String(now.getFullYear()))
  const month = parseInt(sp.month ?? String(now.getMonth() + 1))
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined

  const [branches, data] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    getMonthlyRevenue(year, month, branchId),
  ])

  const maxDay = data.daily.reduce((m, d) => Math.max(m, d.total), 0)

  return (
    <div className="space-y-5 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Monthly Revenue</span>
      </nav>
      <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>Monthly Revenue Report</h1>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Year</label>
          <select name="year" defaultValue={year}
            className="h-9 rounded border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm">
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Month</label>
          <select name="month" defaultValue={month}
            className="h-9 rounded border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm">
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
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
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>View</button>
      </form>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Consultation", value: data.consultationTotal, color: "#1D4ED8" },
          { label: "Treatment", value: data.treatmentTotal, color: BRAND_COLORS.secondaryGreen },
          { label: "Advance", value: data.advanceTotal, color: "#6D28D9" },
          { label: `Total — ${MONTHS[month-1]} ${year}`, value: data.grandTotal, color: BRAND_COLORS.primaryTeal },
        ].map((s) => (
          <Card key={s.label} className="border-[#CCCCCC] bg-white">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily breakdown */}
      <Card className="border-[#CCCCCC] bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
            Day-by-Day — {MONTHS[month-1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.daily.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: BRAND_COLORS.borderDivider }}>
              No revenue data for this period
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                  {["Date", "Consultation", "Treatment", "Advance", "Total", "Bar"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                      style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row) => (
                  <tr key={row.date} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                      {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "#1D4ED8" }}>
                      {row.consultation > 0 ? formatCurrency(row.consultation) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.secondaryGreen }}>
                      {row.treatment > 0 ? formatCurrency(row.treatment) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "#6D28D9" }}>
                      {row.advance > 0 ? formatCurrency(row.advance) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-3 py-2.5 w-32">
                      <div className="h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                        <div className="h-2 rounded-full" style={{
                          width: `${maxDay > 0 ? Math.round((row.total / maxDay) * 100) : 0}%`,
                          backgroundColor: BRAND_COLORS.primaryTeal,
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
