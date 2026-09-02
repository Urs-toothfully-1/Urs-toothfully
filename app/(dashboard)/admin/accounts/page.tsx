import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ledgerRepository, LEDGER_PAGE_SIZE } from "@/server/repositories/ledger.repository"
import { AddLedgerEntryDialog } from "@/components/accounting/AddLedgerEntryDialog"
import { LedgerEntryRow } from "@/components/accounting/LedgerEntryRow"
import { AccountsToolbar } from "@/components/accounting/AccountsToolbar"
import { LEDGER_CATEGORIES } from "@/lib/ledger-categories"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Wallet, TrendingUp, TrendingDown, Scale, Download } from "lucide-react"

export const metadata: Metadata = { title: "Cash Book" }
export const dynamic = "force-dynamic"

const LABEL = Object.fromEntries(LEDGER_CATEGORIES.map((c) => [c.value, c.label]))
const CATEGORY_VALUES = new Set(LEDGER_CATEGORIES.map((c) => c.value))

type Props = {
  searchParams: Promise<{ branch?: string; category?: string; from?: string; to?: string; page?: string }>
}

export default async function AccountsPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams

  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
  const defaultTo = today.toISOString().split("T")[0]
  const fromStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : defaultFrom
  const toStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : defaultTo
  const branchId = sp.branch && sp.branch !== "all" ? sp.branch : undefined
  const category = sp.category && CATEGORY_VALUES.has(sp.category) ? (sp.category as never) : undefined
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  const filters = { branchId, category, fromDate: new Date(`${fromStr}T00:00:00`), toDate: new Date(`${toStr}T23:59:59.999`) }

  const [branches, summary, { entries, total }] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ledgerRepository.summary(filters),
    ledgerRepository.findByBranch(filters, page),
  ])

  const totalPages = Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE))
  const showBranch = !branchId
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    if (branchId) p.set("branch", branchId)
    if (sp.category && category) p.set("category", sp.category)
    p.set("from", fromStr); p.set("to", toStr)
    for (const [k, v] of Object.entries(over)) v ? p.set(k, v) : p.delete(k)
    return `/admin/accounts?${p.toString()}`
  }

  const cards = [
    { label: "Sales (patient payments)", value: summary.sales, icon: TrendingUp, color: "#065F46" },
    { label: "Other income", value: summary.otherIncome, icon: Wallet, color: "#1D4ED8" },
    { label: "Expenses", value: summary.expenses, icon: TrendingDown, color: "#C2410C" },
    { label: "Net", value: summary.net, icon: Scale, color: summary.net >= 0 ? "#065F46" : "#B91C1C" },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Cash Book</h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            Purchases, petty cash & expenses — with sales for the period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/accounts/export?${new URLSearchParams({
              ...(branchId ? { branch: branchId } : {}),
              ...(sp.category && category ? { category: sp.category } : {}),
              from: fromStr, to: toStr,
            }).toString()}`}
            className="inline-flex items-center gap-1.5 h-9 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
            style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }}
          >
            <Download className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> Export
          </a>
          <AddLedgerEntryDialog branches={branches} defaultBranchId={branchId} defaultCategory={sp.category && category ? sp.category : undefined} />
        </div>
      </div>

      {/* Branch dropdown + category quick-switch tabs + date range */}
      <AccountsToolbar
        branches={branches}
        current={{ branch: branchId ?? "all", category: sp.category && category ? sp.category : "all", from: fromStr, to: toStr }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label} className="border-[#E0E3E5] bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: c.color }} />
                  <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{c.label}</p>
                </div>
                <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{formatCurrency(c.value)}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Table */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="pt-4">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No expenses recorded for this period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <p className="text-xs pb-2" style={{ color: BRAND_COLORS.borderDivider }}>{total} entr{total === 1 ? "y" : "ies"}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                    {["Date", "Category", "Payee / Notes", ...(showBranch ? ["Branch"] : []), "Mode", "Amount", ""].map((h) => (
                      <th key={h} className={`py-2 px-2 text-xs font-semibold ${h === "Amount" || h === "" ? "text-right" : "text-left"}`} style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => <LedgerEntryRow key={e.id} entry={{ ...e, amount: Number(e.amount) }} showBranch={showBranch} />)}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  {page > 1
                    ? <Link href={qs({ page: String(page - 1) })} className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#E0E3E5] hover:bg-gray-50" style={{ color: BRAND_COLORS.primaryTeal }}>← Previous</Link>
                    : <span />}
                  <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>Page {page} of {totalPages}</span>
                  {page < totalPages
                    ? <Link href={qs({ page: String(page + 1) })} className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#E0E3E5] hover:bg-gray-50" style={{ color: BRAND_COLORS.primaryTeal }}>Next →</Link>
                    : <span />}
                </div>
              )}
            </div>
          )}

          {/* Expense breakdown by category */}
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <p className="text-xs font-semibold mb-2" style={{ color: BRAND_COLORS.bodyText }}>Expenses by category</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <span key={cat} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: "#FFF4EC", color: "#C2410C" }}>
                    {LABEL[cat] ?? cat}: <strong>{formatCurrency(amt)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
