import Link from "next/link"
import { rewardService } from "@/server/services/reward.service"
import { RedeemPointsDialog, type RedeemCampaign } from "@/components/referrals/RedeemPointsDialog"
import { RewardRowActions } from "@/components/referrals/RewardRowActions"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { rewardText, themeOf } from "@/lib/rewards"
import { Gift, Sparkles, UserPlus, Users } from "lucide-react"

type Campaign = { id: string; name: string; theme: string; referrerOffer: string; refereeOffer: string }

function CampaignChips({ campaigns, side }: { campaigns: Campaign[]; side: "REFERRER" | "REFEREE" }) {
  if (campaigns.length === 0) return <span className="text-[11px]" style={{ color: BRAND_COLORS.borderDivider }}>No campaign was running</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {campaigns.map((c) => {
        const t = themeOf(c.theme)
        return (
          <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: t.soft, color: t.ink }}>
            <strong>{c.name}</strong> · {side === "REFERRER" ? c.referrerOffer : c.refereeOffer}
          </span>
        )
      })}
    </span>
  )
}

/**
 * Referral rewards for one patient: who referred them (and the offers running
 * then), who they referred, points, rewards given, and "Use points" for the
 * doctor. Shown on consultation + treatment screens and the Referrals tab.
 */
export async function ReferralPanel({ patientId, canReward, defaultOpen = false }: { patientId: string; canReward: boolean; defaultOpen?: boolean }) {
  const o = await rewardService.overview(patientId)
  const hasAnything = o.referredBy || o.made.length > 0 || o.redemptions.length > 0
  if (!hasAnything && !defaultOpen) return null

  // Campaigns the doctor can pick from: live now + any that ran at this patient's referrals.
  const pickable = new Map<string, RedeemCampaign>()
  for (const c of [...o.live, ...(o.referredBy?.campaigns ?? []), ...o.made.flatMap((m) => m.campaigns)]) {
    pickable.set(c.id, {
      id: c.id, name: c.name, referrerOffer: c.referrerOffer, refereeOffer: c.refereeOffer,
      referrerKind: c.referrerKind, referrerValue: c.referrerValue != null ? Number(c.referrerValue) : null,
      refereeKind: c.refereeKind, refereeValue: c.refereeValue != null ? Number(c.refereeValue) : null,
    })
  }
  const referrerAvailable = o.points.units.some((u) => u.side === "REFERRER" && u.state === "AVAILABLE")
  const muted = { color: BRAND_COLORS.borderDivider }

  return (
    <details open={defaultOpen} className="group rounded-xl border bg-white" style={{ borderColor: "#BFDBFE" }}>
      <summary className="cursor-pointer list-none px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm rounded-xl" style={{ backgroundColor: "#EFF6FF", color: "#1E3A8A" }}>
        <span className="flex items-center gap-1.5 font-semibold"><Gift className="h-4 w-4" /> Referral rewards</span>
        {o.referredBy && (
          <span className="flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" /> Referred by <strong>{o.referredBy.referrer.fullName}</strong>
            <span className="text-xs opacity-80">on {formatDate(o.referredBy.createdAt)}</span>
          </span>
        )}
        {o.made.length > 0 && (
          <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Referred {o.made.length} patient{o.made.length === 1 ? "" : "s"}</span>
        )}
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: o.points.available ? "#1D4ED8" : "#CBD5E1", color: "white" }}>
          {o.points.available} point{o.points.available === 1 ? "" : "s"} available
        </span>
        {o.points.pending > 0 && <span className="text-xs opacity-80">+{o.points.pending} after first visit</span>}
        <span className="ml-auto text-xs opacity-70 group-open:hidden">Show details ▾</span>
        <span className="ml-auto text-xs opacity-70 hidden group-open:inline">Hide ▴</span>
      </summary>

      <div className="px-4 py-3 space-y-4 text-sm">
        {o.live.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}><Sparkles className="h-3.5 w-3.5" /> Running now:</span>
            {o.live.map((c) => {
              const t = themeOf(c.theme)
              return <span key={c.id} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>{c.name}</span>
            })}
          </div>
        )}

        {o.referredBy && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: BRAND_COLORS.bodyText }}>Referred by</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/patients/${o.referredBy.referrer.id}/referrals`} className="font-medium hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
                {o.referredBy.referrer.fullName}
              </Link>
              <span className="text-xs" style={muted}>({o.referredBy.referrer.patientId}) · {formatDate(o.referredBy.createdAt)}</span>
              <CampaignChips campaigns={o.referredBy.campaigns} side="REFEREE" />
            </div>
          </div>
        )}

        {o.made.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: BRAND_COLORS.bodyText }}>Patients they referred</p>
            <ul className="space-y-1.5">
              {o.made.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/patients/${m.referee.id}`} className="font-medium hover:underline" style={{ color: BRAND_COLORS.bodyText }}>{m.referee.fullName}</Link>
                  <span className="text-xs" style={muted}>{formatDate(m.createdAt)}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={
                    m.referrerRedemptionId ? { backgroundColor: "#F3F4F6", color: "#6B7280" }
                      : m.status === "PENDING" ? { backgroundColor: "#FEF3C7", color: "#92400E" }
                      : { backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>
                    {m.referrerRedemptionId ? "point used" : m.status === "PENDING" ? "awaiting first visit" : "1 point"}
                  </span>
                  <CampaignChips campaigns={m.campaigns} side="REFERRER" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Rewards given</p>
            {canReward && (
              <RedeemPointsDialog patientId={patientId} available={o.points.available} campaigns={[...pickable.values()]} defaultSide={referrerAvailable ? "REFERRER" : "REFEREE"} />
            )}
          </div>
          {o.redemptions.length === 0 ? (
            <p className="text-xs" style={muted}>None yet.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {o.redemptions.map((r) => (
                <li key={r.id} className="py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>{rewardText(r.kind, Number(r.value), r.description)}</span>
                  <span className="text-xs" style={muted}>
                    {r.points} pt{r.points === 1 ? "" : "s"}{r.campaign ? ` · ${r.campaign.name}` : ""} · {formatDate(r.createdAt)} · {r.createdBy.name}
                  </span>
                  {r.usedAt ? (
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                      Used {formatDate(r.usedAt)}{r.usedNote ? ` — ${r.usedNote}` : ""}
                    </span>
                  ) : (
                    <>
                      <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>Not used yet</span>
                      {canReward && <RewardRowActions id={r.id} patientId={patientId} />}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  )
}
