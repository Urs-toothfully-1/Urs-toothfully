import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOutstandingBalances } from "@/lib/reports/outstanding-balances"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, AlertCircle } from "lucide-react"

export const metadata: Metadata = { title: "Outstanding Balances" }
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ branch?: string }> }

export default async function OutstandingBalancesPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined

  const [branches, data] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    getOutstandingBalances(branchId),
  ])

  const totalOutstanding = data.reduce((s, r) => s + r.balance, 0)
  const totalPaid = data.reduce((s, r) => s + r.paid, 0)

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
        <Link href="/admin/reports" style={{ color: BRAND_COLORS.primaryTeal }} className="hover:underline">Reports</Link>
        <ChevronRight className="h-3.5 w-3.5" /><span>Outstanding Balances</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Outstanding Balances</h1>

      <form method="GET" className="flex gap-3 items-end">
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tracking-tight" style={{ color: "#E57373" }}>{formatCurrency(totalOutstanding)}</p>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>Total Outstanding</p>
          </CardContent>
        </Card>
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(totalPaid)}</p>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>Already Collected</p>
          </CardContent>
        </Card>
        <Card className="border-[#E0E3E5] bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.primaryTeal }}>{data.length}</p>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>Pending Estimates</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>No outstanding balances</p>
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>All active estimates are fully paid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
                    {["Patient", "Mobile", "Estimate", "Branch", "Date", "Days", "Total", "Paid", "Balance"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                        style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.estimateId} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                      <td className="px-3 py-2.5">
                        <Link href={`/patients/${row.patientId}`}
                          className="font-medium hover:underline text-sm" style={{ color: BRAND_COLORS.primaryTeal }}>
                          {row.patientName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{row.patientMobile}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/doctor/estimate/${row.estimateId}`}
                          className="text-xs font-mono hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
                          {row.estimateNo}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{row.branchName}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{formatDate(row.estimateDate)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: row.daysSince > 30 ? "#FEE2E2" : row.daysSince > 7 ? "#FEF3C7" : BRAND_COLORS.lightBackground,
                            color: row.daysSince > 30 ? "#B91C1C" : row.daysSince > 7 ? "#B45309" : BRAND_COLORS.borderDivider,
                          }}>
                          {row.daysSince}d
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(row.total)}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(row.paid)}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-bold" style={{ color: "#E57373" }}>{formatCurrency(row.balance)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
