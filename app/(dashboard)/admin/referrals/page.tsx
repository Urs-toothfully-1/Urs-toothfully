import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { istTodayStr } from "@/lib/ist"
import { campaignStatus, rewardText, type RewardKind } from "@/lib/rewards"
import { formatDate } from "@/lib/utils"
import { referralService } from "@/server/services/referral.service"
import { rewardService } from "@/server/services/reward.service"
import { CampaignManager, type CampaignView } from "@/components/referrals/CampaignManager"
import { Award, Crown, Gift, Sparkles, Users } from "lucide-react"

export const metadata: Metadata = { title: "Rewards & Referrals" }
export const dynamic = "force-dynamic"

type Status = "PENDING" | "QUALIFIED" | "REWARDED" | "CANCELLED"
const STATUSES: { key: Status; label: string }[] = [
  { key: "PENDING", label: "Awaiting first visit" },
  { key: "QUALIFIED", label: "Visited" },
  { key: "CANCELLED", label: "Cancelled" },
]
const STATUS_COLOR: Record<string, string> = { PENDING: "#B45309", QUALIFIED: "#1D4ED8", REWARDED: "#1D4ED8", CANCELLED: "#6B7280" }
const STATUS_LABEL: Record<string, string> = { PENDING: "Awaiting first visit", QUALIFIED: "Visited", REWARDED: "Visited", CANCELLED: "Cancelled" }

type Props = { searchParams: Promise<{ status?: string }> }

export default async function RewardsPage({ searchParams }: Props) {
  await requireRole(["ADMIN"])
  const sp = await searchParams
  const status = STATUSES.some((s) => s.key === sp.status) ? (sp.status as Status) : undefined

  const [campaigns, referrals, totals, earned, usedReferrer, usedReferee, rewardsGiven, top, recent] = await Promise.all([
    rewardService.listCampaigns(),
    referralService.list({ status }),
    prisma.referral.count({ where: { status: { not: "CANCELLED" } } }),
    prisma.referral.count({ where: { status: { in: ["QUALIFIED", "REWARDED"] } } }),
    prisma.referral.count({ where: { referrerRedemptionId: { not: null } } }),
    prisma.referral.count({ where: { refereeRedemptionId: { not: null } } }),
    prisma.referralRedemption.count(),
    prisma.referral.groupBy({ by: ["referrerId"], where: { status: { not: "CANCELLED" } }, _count: { _all: true }, orderBy: { _count: { referrerId: "desc" } }, take: 5 }),
    prisma.referralRedemption.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      include: { patient: { select: { id: true, fullName: true } }, campaign: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
  ])
  const topPatients = await prisma.patient.findMany({ where: { id: { in: top.map((t) => t.referrerId) } }, select: { id: true, fullName: true, patientId: true } })
  const today = istTodayStr()
  const views: CampaignView[] = campaigns.map((c) => ({
    id: c.id, name: c.name, tagline: c.tagline, referrerOffer: c.referrerOffer, refereeOffer: c.refereeOffer,
    referrerKind: c.referrerKind, referrerValue: c.referrerValue != null ? Number(c.referrerValue) : null,
    refereeKind: c.refereeKind, refereeValue: c.refereeValue != null ? Number(c.refereeValue) : null,
    terms: c.terms, startsAt: c.startsAt.toISOString().slice(0, 10), endsAt: c.endsAt ? c.endsAt.toISOString().slice(0, 10) : null,
    isActive: c.isActive, theme: c.theme, status: campaignStatus(c, today), rewardsGiven: c._count.redemptions,
  }))
  const live = views.filter((v) => v.status === "LIVE").length
  const pointsEarned = earned * 2 // 1 for the referrer + 1 for the new patient
  const pointsUsed = usedReferrer + usedReferee

  const stats = [
    { label: "Referrals", value: totals, icon: Users },
    { label: "Points earned", value: pointsEarned, icon: Sparkles },
    { label: "Points used", value: pointsUsed, icon: Award },
    { label: "Rewards given", value: rewardsGiven, icon: Gift },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-7 md:px-8 md:py-8 text-white shadow-[0_20px_40px_-20px_rgba(0,94,151,0.6)]"
        style={{ background: "linear-gradient(120deg, #003E66 0%, #005E97 45%, #006B5F 100%)" }}>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fff 0%, transparent 65%)" }} />
        <div className="pointer-events-none absolute right-40 -bottom-28 h-64 w-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #8DC21F 0%, transparent 65%)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Ur&apos;s Toothfully</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Rewards &amp; Referrals</h1>
            <p className="mt-1.5 text-sm text-white/80 max-w-xl">
              Every referral earns 1 point for the patient who referred and 1 for the friend they brought, once the friend visits.
              Doctors spend points on rewards — each point only once.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" /> {live} campaign{live === 1 ? "" : "s"} live
          </span>
        </div>
        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-white/75"><Icon className="h-3.5 w-3.5" /> {label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </div>

      <CampaignManager campaigns={views} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top referrers */}
        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Top referrers</h2>
          {top.length === 0 ? (
            <p className="mt-6 mb-4 text-sm text-center text-gray-500">No referrals yet.</p>
          ) : (
            <ol className="mt-3 space-y-1">
              {top.map((t, i) => {
                const p = topPatients.find((x) => x.id === t.referrerId)
                return (
                  <li key={t.referrerId} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
                    <span className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={i === 0 ? { background: "linear-gradient(135deg,#FCD34D,#B7791F)", color: "white" } : { backgroundColor: "#F1F5F9", color: "#475569" }}>
                      {i + 1}
                    </span>
                    <Link href={`/patients/${t.referrerId}/referrals`} className="flex-1 min-w-0 truncate font-medium text-gray-900 hover:underline">{p?.fullName ?? "—"}</Link>
                    <span className="text-xs font-mono text-gray-400">{p?.patientId}</span>
                    <span className="text-sm font-semibold text-[#005E97] tabular-nums">{t._count._all}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Recent rewards */}
        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Gift className="h-4 w-4 text-[#006B5F]" /> Recent rewards</h2>
          {recent.length === 0 ? (
            <p className="mt-6 mb-4 text-sm text-center text-gray-500">Rewards doctors give will appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {recent.map((r) => (
                <li key={r.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/patients/${r.patient.id}/referrals`} className="font-medium text-gray-900 hover:underline">{r.patient.fullName}</Link>
                    <p className="text-xs text-gray-500 truncate">
                      {rewardText(r.kind as RewardKind, Number(r.value), r.description)} · {r.points} pt{r.points === 1 ? "" : "s"}
                      {r.campaign ? ` · ${r.campaign.name}` : ""} · {r.createdBy.name}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.usedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {r.usedAt ? "Used" : "Unused"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* All referrals */}
      <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-[#005E97]" /> All referrals</h2>
          <div className="flex flex-wrap gap-1.5">
            {[{ key: undefined, label: "All" }, ...STATUSES].map((s) => {
              const active = status === s.key || (!status && !s.key)
              return (
                <Link key={s.label} href={s.key ? `/admin/referrals?status=${s.key}` : "/admin/referrals"}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[#005E97] text-white border-[#005E97]" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"}`}>
                  {s.label}
                </Link>
              )
            })}
          </div>
        </div>
        {referrals.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No referrals in this view yet.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/70">
                  {["Referred by", "New patient", "Date", "Branch", "Status"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="py-2.5 px-5">
                      <Link href={`/patients/${r.referrer.id}/referrals`} className="font-medium text-gray-900 hover:underline">{r.referrer.fullName}</Link>
                      <span className="block text-[11px] font-mono text-gray-400">{r.referrer.patientId}</span>
                    </td>
                    <td className="py-2.5 px-5">
                      <Link href={`/patients/${r.referee.id}/referrals`} className="text-gray-800 hover:underline">{r.referee.fullName}</Link>
                      <span className="block text-[11px] font-mono text-gray-400">{r.referee.patientId}</span>
                    </td>
                    <td className="py-2.5 px-5 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                    <td className="py-2.5 px-5 text-xs text-gray-500">{r.branch.name}</td>
                    <td className="py-2.5 px-5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${STATUS_COLOR[r.status]}18`, color: STATUS_COLOR[r.status] }}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
