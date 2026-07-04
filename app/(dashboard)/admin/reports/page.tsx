import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { BarChart2, CreditCard, Users, TrendingUp, AlertCircle, Tag } from "lucide-react"

export const metadata: Metadata = { title: "Reports" }

const REPORTS = [
  {
    title: "Daily Revenue",
    description: "Revenue breakdown by payment type and mode for any given day",
    href: "/admin/reports/daily",
    icon: CreditCard,
    color: BRAND_COLORS.primaryTeal,
  },
  {
    title: "Monthly Revenue",
    description: "Day-by-day revenue trend for any month",
    href: "/admin/reports/monthly",
    icon: TrendingUp,
    color: BRAND_COLORS.secondaryGreen,
  },
  {
    title: "Doctor Revenue",
    description: "Estimate totals and patient counts per doctor",
    href: "/admin/reports/doctor",
    icon: Users,
    color: BRAND_COLORS.primaryTeal,
  },
  {
    title: "Treatment Category",
    description: "Revenue breakdown by dental treatment category",
    href: "/admin/reports/treatment",
    icon: BarChart2,
    color: BRAND_COLORS.primaryTeal,
  },
  {
    title: "Lead Source",
    description: "Where new patients are coming from",
    href: "/admin/reports/lead-source",
    icon: Tag,
    color: BRAND_COLORS.secondaryGreen,
  },
  {
    title: "Outstanding Balances",
    description: "Patients with pending payment on active estimates",
    href: "/admin/reports/outstanding",
    icon: AlertCircle,
    color: "#E57373",
  },
]

export default async function ReportsIndexPage() {
  await requireRole(["ADMIN"])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Business intelligence for clinic management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon
          return (
            <Link key={report.href} href={report.href}>
              <Card className="h-full border-[#E0E3E5] hover:shadow-md hover:border-[#0077BE] transition-all cursor-pointer">
                <CardContent className="p-5 flex gap-4">
                  <div className="rounded-xl p-3 flex-shrink-0" style={{ backgroundColor: `${report.color}15` }}>
                    <Icon className="h-6 w-6" style={{ color: report.color }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{report.title}</p>
                    <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                      {report.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
