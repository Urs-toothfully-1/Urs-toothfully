import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { accountingRepository } from "@/server/repositories/accounting.repository"
import { prisma } from "@/lib/prisma"
import { AccountingEntryRow } from "@/components/accounting/AccountingEntryRow"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
type AccountingStatus = "PENDING_REVIEW" | "APPROVED" | "EXPORTED"
type PaymentType = "CONSULTATION" | "TREATMENT" | "ADVANCE" | "ADJUSTMENT" | "PRODUCT"

export const metadata: Metadata = { title: "Accounting Ledger" }
export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{
    branch?: string; from?: string; to?: string
    status?: string; type?: string; page?: string
  }>
}

const PAGE_SIZE = 50

export default async function AccountingPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams

  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
  const defaultTo = today.toISOString().split("T")[0]

  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined
  const fromDate = sp.from || defaultFrom
  const toDate = sp.to || defaultTo
  const status = sp.status && sp.status !== "all" ? (sp.status as AccountingStatus) : undefined
  const paymentType = sp.type && sp.type !== "all" ? (sp.type as PaymentType) : undefined
  const page = parseInt(sp.page ?? "1")

  const [branches, result, summary] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    accountingRepository.findByBranch({
      branchId, fromDate: new Date(fromDate), toDate: new Date(toDate + "T23:59:59"),
      status, paymentType, page, pageSize: PAGE_SIZE,
    }),
    accountingRepository.getSummaryByType({
      branchId, fromDate: new Date(fromDate), toDate: new Date(toDate + "T23:59:59"),
    }),
  ])

  const { entries, total } = result
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const grandTotal = summary.reduce((s: number, r: { _sum: { amount: unknown } }) => s + Number(r._sum.amount ?? 0), 0)

  const pending = entries.filter((e: { status: string }) => e.status === "PENDING_REVIEW").length

  function buildUrl(updates: Record<string, string>) {
    const params = new URLSearchParams({
      branch: sp.branch ?? "all", from: fromDate, to: toDate,
      status: sp.status ?? "all", type: sp.type ?? "all", page: "1",
      ...updates,
    })
    return `/admin/accounting?${params.toString()}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
            Accounting Ledger
          </h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {total} entries · Total {formatCurrency(grandTotal)}
            {pending > 0 && (
              <span className="ml-2 font-semibold" style={{ color: "#B45309" }}>
                · {pending} pending review
              </span>
            )}
          </p>
        </div>
        <Link
          href="/admin/tally"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ backgroundColor: BRAND_COLORS.secondaryGreen }}
        >
          Export to Tally
        </Link>
      </div>

      {/* Summary by type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s: { paymentType: string; _sum: { amount: unknown }; _count: number }) => (
          <Card key={s.paymentType} className="border-[#E0E3E5] bg-white">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
                {formatCurrency(Number(s._sum.amount ?? 0))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {s.paymentType} ({s._count})
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="p-4">
          <form method="GET" action="/admin/accounting" className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Branch</label>
              <select name="branch" defaultValue={sp.branch ?? "all"}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="all">All Branches</option>
                {branches.map((b: { id: string; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>From</label>
              <input type="date" name="from" defaultValue={fromDate}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>To</label>
              <input type="date" name="to" defaultValue={toDate}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Status</label>
              <select name="status" defaultValue={sp.status ?? "all"}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="all">All Status</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="EXPORTED">Exported</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>Type</label>
              <select name="type" defaultValue={sp.type ?? "all"}
                className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm">
                <option value="all">All Types</option>
                <option value="CONSULTATION">Consultation</option>
                <option value="TREATMENT">Treatment</option>
                <option value="ADVANCE">Advance</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="PRODUCT">Products &amp; Services</option>
              </select>
            </div>
            <button type="submit" className="h-9 px-4 rounded text-sm font-medium text-white"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
              Filter
            </button>
            <Link href="/admin/accounting" className="h-9 px-4 rounded text-sm font-medium flex items-center border border-[#E0E3E5]"
              style={{ color: BRAND_COLORS.bodyText }}>
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-[#E0E3E5] bg-white overflow-hidden">
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <BookOpen className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No entries found for selected filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: BRAND_COLORS.lightBackground, borderBottom: `1px solid ${BRAND_COLORS.borderDivider}20` }}>
                    {["Date", "Patient", "Type", "Mode", "Amount", "Status", "Receipt", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                        style={{ color: BRAND_COLORS.borderDivider }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <AccountingEntryRow
                      key={entry.id}
                      entry={{ ...entry, amount: Number(entry.amount) } as any}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: BRAND_COLORS.borderDivider }}>
            Page {page} of {totalPages} · {total} total entries
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E0E3E5] hover:bg-white"
                style={{ color: BRAND_COLORS.bodyText }}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E0E3E5] hover:bg-white"
                style={{ color: BRAND_COLORS.bodyText }}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
