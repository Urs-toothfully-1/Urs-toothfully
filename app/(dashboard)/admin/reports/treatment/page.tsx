import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTreatmentRevenue } from "@/lib/reports/treatment-revenue"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Treatment Category Revenue" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ from?: string; to?: string; branch?: string }> }

export default async function TreatmentRevenueReportPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const defaultTo = now.toISOString().split("T")[0]
  const from = sp.from ?? defaultFrom
  const to = sp.to ?? defaultTo
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined

  const [branches, data] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    getTreatmentRevenue(new Date(from), new Date(to + "T23:59:59"), branchId),
  ])

  const grandTotal = data.reduce((s, r) => s + r.totalRevenue, 0)

  return (
    <div className="space-y-5 max-w-3xl">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Treatment Category</span>
      </nav>
      <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>Treatment Category Revenue</h1>

      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>From</label>
          <input type="date" name="from" defaultValue={from}
            className="h-9 rounded border border-[#CCCCCC] bg-[#EBECEE] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>To</label>
          <input type="date" name="to" defaultValue={to} max={defaultTo}
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
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>View</button>
      </form>

      <Card className="border-[#CCCCCC] bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>By Category</CardTitle>
            <span className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(grandTotal)}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: BRAND_COLORS.borderDivider }}>No treatment data for this period</p>
          ) : (
            <div className="divide-y" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              {data.map((row) => (
                <div key={row.category} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm" style={{ color: BRAND_COLORS.bodyText }}>{row.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{row.itemCount} items</span>
                      <span className="font-bold text-sm" style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(row.totalRevenue)}</span>
                      <span className="text-xs w-8 text-right" style={{ color: BRAND_COLORS.borderDivider }}>{row.percentOfTotal}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                    <div className="h-2 rounded-full transition-all" style={{
                      width: `${row.percentOfTotal}%`,
                      backgroundColor: BRAND_COLORS.primaryTeal,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
