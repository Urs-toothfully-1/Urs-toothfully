import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { referralService } from "@/server/services/referral.service"
import { GrantRewardDialog } from "@/components/referrals/GrantRewardDialog"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Clock, CheckCircle2, Gift } from "lucide-react"

export const metadata: Metadata = { title: "Referrals" }
export const dynamic = "force-dynamic"

type Status = "PENDING" | "QUALIFIED" | "REWARDED" | "CANCELLED"
const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: "PENDING", label: "Pending", color: "#B45309" },
  { key: "QUALIFIED", label: "Qualified", color: "#1D4ED8" },
  { key: "REWARDED", label: "Rewarded", color: "#065F46" },
  { key: "CANCELLED", label: "Cancelled", color: "#6B7280" },
]
const STATUS_COLOR = Object.fromEntries(STATUSES.map((s) => [s.key, s.color]))

type Props = { searchParams: Promise<{ status?: string }> }

export default async function ReferralsPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const status = STATUSES.some((s) => s.key === sp.status) ? (sp.status as Status) : undefined

  const [grouped, referrals] = await Promise.all([
    prisma.referral.groupBy({ by: ["status"], _count: { _all: true } }),
    referralService.list({ status }),
  ])
  const counts: Record<string, number> = {}
  for (const g of grouped) counts[g.status] = g._count._all
  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  const cards = [
    { label: "Total referrals", value: total, icon: Users, color: BRAND_COLORS.primaryTeal },
    { label: "Pending", value: counts.PENDING ?? 0, icon: Clock, color: "#B45309" },
    { label: "Qualified (reward due)", value: counts.QUALIFIED ?? 0, icon: CheckCircle2, color: "#1D4ED8" },
    { label: "Rewarded", value: counts.REWARDED ?? 0, icon: Gift, color: "#065F46" },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Referrals</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Patients who referred new patients. Qualified referrals are ready to reward.
        </p>
      </div>

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
                <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[{ key: undefined, label: "All" }, ...STATUSES].map((s) => {
          const active = status === s.key || (!status && !s.key)
          return (
            <Link
              key={s.label}
              href={s.key ? `/admin/referrals?status=${s.key}` : "/admin/referrals"}
              className="px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: active ? BRAND_COLORS.primaryTeal : "white",
                color: active ? "white" : BRAND_COLORS.bodyText,
                borderColor: active ? BRAND_COLORS.primaryTeal : "#E0E3E5",
              }}
            >
              {s.label}
            </Link>
          )
        })}
      </div>

      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="pt-4">
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No referrals in this view yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                    {["Referred by", "New patient", "Branch", "Status", "Reward", ""].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                      <td className="py-2.5 px-2">
                        <Link href={`/patients/${r.referrer.id}`} className="font-medium hover:underline" style={{ color: BRAND_COLORS.bodyText }}>{r.referrer.fullName}</Link>
                        <span className="block text-[11px] font-mono" style={{ color: BRAND_COLORS.borderDivider }}>{r.referrer.patientId}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <Link href={`/patients/${r.referee.id}`} className="hover:underline" style={{ color: BRAND_COLORS.bodyText }}>{r.referee.fullName}</Link>
                        <span className="block text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>{formatDate(r.createdAt)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{r.branch.name}</td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${STATUS_COLOR[r.status]}18`, color: STATUS_COLOR[r.status] }}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                        {r.rewardType
                          ? `${r.rewardType === "MONETARY" ? "Cash" : "Credit"} ${formatCurrency(Number(r.rewardAmount))}`
                          : <span style={{ color: BRAND_COLORS.borderDivider }}>—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {r.status === "QUALIFIED" && (
                          <GrantRewardDialog referralId={r.id} referrerName={r.referrer.fullName} refereeName={r.referee.fullName} />
                        )}
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
