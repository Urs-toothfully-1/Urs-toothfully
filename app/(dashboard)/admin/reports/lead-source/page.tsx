import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { getLeadSourceReport } from "@/lib/reports/lead-source"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Lead Source Report" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ from?: string; to?: string }> }

const SOURCE_COLORS: Record<string, string> = {
  "Walk-in": BRAND_COLORS.primaryTeal,
  "Referral": BRAND_COLORS.secondaryGreen,
  "Online": "#6D28D9",
  "Google": "#1D4ED8",
  "Social Media": "#EC4899",
  "Friend / Family": "#F59E0B",
}

export default async function LeadSourceReportPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
  const defaultTo = now.toISOString().split("T")[0]
  const from = sp.from ?? defaultFrom
  const to = sp.to ?? defaultTo
  const data = await getLeadSourceReport(new Date(from), new Date(to + "T23:59:59"))
  const total = data.reduce((s, r) => s + r.count, 0)

  return (
    <div className="space-y-5 max-w-2xl">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Lead Sources</span>
      </nav>
      <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>Lead Source Performance</h1>

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
        <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>View</button>
      </form>

      <Card className="border-[#CCCCCC] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>Patient Sources</CardTitle>
            <span className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>{total} total patients</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {data.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: BRAND_COLORS.borderDivider }}>No registration data</p>
          ) : (
            <div className="space-y-4">
              {data.map((row) => {
                const color = SOURCE_COLORS[row.source] ?? BRAND_COLORS.borderDivider
                return (
                  <div key={row.source}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                        {row.source}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm" style={{ color }}>
                          {row.count} patients
                        </span>
                        <span className="text-xs w-8 text-right" style={{ color: BRAND_COLORS.borderDivider }}>
                          {row.percentOfTotal}%
                        </span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                      <div className="h-3 rounded-full" style={{ width: `${row.percentOfTotal}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
