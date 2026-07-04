import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users, CreditCard, ClipboardList, AlertCircle,
  FileText, TrendingUp, Building2, Clock,
  BarChart2, BookOpen, FileSpreadsheet, Shield,
} from "lucide-react"

export const metadata: Metadata = { title: "Admin Dashboard" }
export const dynamic = "force-dynamic"

async function getAdminKPIs(branchId: string) {
  const today = new Date()
  const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [
    patientsToday, revenueToday, inQueue, outstandingEstimates,
    estimatesThisMonth, revenueThisMonth, activeBranches, pendingReview,
  ] = await Promise.all([
    // Patients registered today
    prisma.patient.count({ where: { isDeleted: false, createdAt: { gte: todayStart, lte: todayEnd } } }),

    // Revenue today (all branches for admin)
    prisma.accountingEntry.aggregate({
      where: { isDeleted: false, entryDate: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
    }),

    // In queue right now (this branch)
    prisma.queueEntry.count({
      where: { branchId, status: { in: ["WAITING", "WITH_DOCTOR", "ESTIMATE_CREATED"] } },
    }),

    // Outstanding balances (all active estimates)
    prisma.estimate.findMany({
      where: { status: "ACTIVE", isDeleted: false },
      select: { total: true, payments: { where: { isDeleted: false, paymentType: { in: ["ADVANCE", "TREATMENT"] } }, select: { amount: true } } },
    }),

    // Estimates this month
    prisma.estimate.count({ where: { isDeleted: false, createdAt: { gte: monthStart } } }),

    // Revenue this month
    prisma.accountingEntry.aggregate({
      where: { isDeleted: false, entryDate: { gte: monthStart } },
      _sum: { amount: true },
    }),

    // Active branches
    prisma.branch.count({ where: { isActive: true } }),

    // Pending review entries
    prisma.accountingEntry.count({ where: { isDeleted: false, status: "PENDING_REVIEW" } }),
  ])

  const totalOutstanding = outstandingEstimates.reduce((s: number, e: { total: unknown; payments: { amount: unknown }[] }) => {
    const paid = e.payments.reduce((ps: number, p: { amount: unknown }) => ps + Number(p.amount), 0)
    return s + Math.max(0, Number(e.total) - paid)
  }, 0)

  return {
    patientsToday,
    revenueToday: Number(revenueToday._sum.amount ?? 0),
    inQueue,
    totalOutstanding,
    estimatesThisMonth,
    revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
    activeBranches,
    pendingReview,
  }
}

export default async function AdminPage() {
  const session = await requireRole(["ADMIN"])
  const kpis = await getAdminKPIs(session.branchId)

  const today = new Date()
  const monthName = today.toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  const KPI_CARDS = [
    { label: "Patients Today", value: kpis.patientsToday.toString(), icon: Users, color: BRAND_COLORS.primaryTeal, href: "/patients" },
    { label: "Revenue Today", value: formatCurrency(kpis.revenueToday), icon: CreditCard, color: BRAND_COLORS.secondaryGreen, href: "/admin/reports/daily" },
    { label: "In Queue Now", value: kpis.inQueue.toString(), icon: ClipboardList, color: BRAND_COLORS.primaryTeal, href: "/reception" },
    { label: "Outstanding Balance", value: formatCurrency(kpis.totalOutstanding), icon: AlertCircle, color: kpis.totalOutstanding > 0 ? "#E57373" : BRAND_COLORS.secondaryGreen, href: "/admin/reports/outstanding" },
    { label: `Estimates — ${monthName}`, value: kpis.estimatesThisMonth.toString(), icon: FileText, color: BRAND_COLORS.primaryTeal, href: "/admin/reports/doctor" },
    { label: `Revenue — ${monthName}`, value: formatCurrency(kpis.revenueThisMonth), icon: TrendingUp, color: BRAND_COLORS.secondaryGreen, href: "/admin/reports/monthly" },
    { label: "Active Branches", value: kpis.activeBranches.toString(), icon: Building2, color: BRAND_COLORS.primaryTeal, href: "/admin/settings" },
    { label: "Pending Review", value: kpis.pendingReview.toString(), icon: Clock, color: kpis.pendingReview > 0 ? "#F59E0B" : BRAND_COLORS.secondaryGreen, href: "/admin/accounting" },
  ]

  const MODULE_LINKS = [
    { title: "Daily Revenue", desc: `Today: ${formatCurrency(kpis.revenueToday)}`, href: "/admin/reports/daily", icon: CreditCard },
    { title: "Monthly Revenue", desc: monthName, href: "/admin/reports/monthly", icon: TrendingUp },
    { title: "Doctor Revenue", desc: "Estimates by doctor", href: "/admin/reports/doctor", icon: Users },
    { title: "Treatment Mix", desc: "Revenue by category", href: "/admin/reports/treatment", icon: BarChart2 },
    { title: "Lead Sources", desc: "Where patients come from", href: "/admin/reports/lead-source", icon: Users },
    { title: "Outstanding", desc: `${formatCurrency(kpis.totalOutstanding)} due`, href: "/admin/reports/outstanding", icon: AlertCircle },
    { title: "Accounting", desc: `${kpis.pendingReview} pending`, href: "/admin/accounting", icon: BookOpen },
    { title: "Tally Export", desc: "CSV for Tally", href: "/admin/tally", icon: FileSpreadsheet },
    { title: "Treatment Master", desc: "Manage treatments & prices", href: "/admin/treatments", icon: ClipboardList },
    { title: "Doctor Availability", desc: "Set working schedules", href: "/admin/availability", icon: Clock },
    { title: "Audit Log", desc: "All system changes", href: "/admin/audit", icon: Shield },
    { title: "Settings", desc: "Branch & system config", href: "/admin/settings", icon: Building2 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Admin Dashboard</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          All branches · {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="border-[#E0E3E5] bg-white hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
                    {kpi.label}
                  </CardTitle>
                  <div className="rounded-full p-1.5" style={{ backgroundColor: `${kpi.color}1A` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
                  </div>
                </CardHeader>
                <CardContent className="pb-4 px-4">
                  <p className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>{kpi.value}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Module Grid */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: BRAND_COLORS.bodyText }}>Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULE_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full border-[#E0E3E5] hover:shadow-md hover:border-[#0077BE] transition-all cursor-pointer">
                  <CardContent className="p-3 flex items-start gap-2.5">
                    <div className="rounded-md p-1.5 mt-0.5 flex-shrink-0" style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.primaryTeal }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
