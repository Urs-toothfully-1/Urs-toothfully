import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDoctorRevenue } from "@/lib/reports/doctor-revenue"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"

export const metadata: Metadata = { title: "Doctor Revenue Report" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ from?: string; to?: string; branch?: string }> }

export default async function DoctorRevenueReportPage({ searchParams }: Props) {
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
    getDoctorRevenue(new Date(from), new Date(to + "T23:59:59"), branchId),
  ])

  const grandTotal = data.reduce((s, r) => s + r.estimateTotal, 0)

  return (
    <div className="space-y-5 max-w-4xl">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Doctor Revenue</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Doctor Revenue Report</h1>

      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>From</label>
          <input type="date" name="from" defaultValue={from}
            className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-3 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>To</label>
          <input type="date" name="to" defaultValue={to} max={defaultTo}
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
        <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>View</button>
      </form>

      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
              {data.length} doctor{data.length !== 1 ? "s" : ""}
            </CardTitle>
            <span className="text-sm font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
              Total: {formatCurrency(grandTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: BRAND_COLORS.borderDivider }}>No estimates in this period</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                  {["Doctor", "Reg No", "Patients", "Estimates", "Total Revenue", "Share"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.doctorId} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <td className="px-4 py-3 font-medium" style={{ color: BRAND_COLORS.bodyText }}>{row.doctorName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{row.doctorRegNo ?? "—"}</td>
                    <td className="px-4 py-3 text-center" style={{ color: BRAND_COLORS.bodyText }}>{row.patientCount}</td>
                    <td className="px-4 py-3 text-center" style={{ color: BRAND_COLORS.bodyText }}>{row.estimateCount}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(row.estimateTotal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                          <div className="h-2 rounded-full" style={{
                            width: `${grandTotal > 0 ? Math.round((row.estimateTotal / grandTotal) * 100) : 0}%`,
                            backgroundColor: BRAND_COLORS.primaryTeal,
                          }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color: BRAND_COLORS.borderDivider }}>
                          {grandTotal > 0 ? Math.round((row.estimateTotal / grandTotal) * 100) : 0}%
                        </span>
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
