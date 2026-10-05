import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { referralService, rewardLabel } from "@/server/services/referral.service"
import { GrantRewardDialog } from "@/components/referrals/GrantRewardDialog"
import { MarkRewardUsedButton } from "@/components/referrals/MarkRewardUsedButton"
import { ReferrerPicker } from "@/components/referrals/ReferrerPicker"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gift, UserPlus, Users } from "lucide-react"

export const metadata: Metadata = { title: "Referrals" }

type Props = { params: Promise<{ patientId: string }> }

const STATUS_LABEL: Record<string, [string, string]> = {
  PENDING: ["Registered", "#B45309"],
  QUALIFIED: ["Paid first visit", "#1D4ED8"],
  REWARDED: ["Rewarded", "#065F46"],
  CANCELLED: ["Cancelled", "#6B7280"],
}

export default async function PatientReferralsPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  const { patientId } = await params
  const canReward = session.role === "ADMIN" || session.role === "DOCTOR"
  const { code, mobile, referredBy, made } = await referralService.overviewForPatient(patientId)
  const muted = { color: BRAND_COLORS.borderDivider }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Gift className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> Their referral code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: BRAND_COLORS.primaryTeal }}>{code}</p>
            <p className="text-xs" style={muted}>
              New patients can give this code, or this patient&apos;s mobile <strong>{mobile}</strong>, at registration.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <UserPlus className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> Referred by
            </CardTitle>
          </CardHeader>
          <CardContent>
            {referredBy ? (
              <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                <Link href={`/patients/${referredBy.referrer.id}/referrals`} className="font-semibold hover:underline">
                  {referredBy.referrer.fullName}
                </Link>{" "}
                <span className="font-mono text-xs" style={muted}>({referredBy.referrer.patientId})</span>
                <span className="block text-xs mt-1" style={muted}>on {formatDate(referredBy.createdAt)}</span>
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={muted}>Not recorded. Find the referrer by code or mobile:</p>
                <ReferrerPicker refereeId={patientId} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <Users className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> People this patient referred
            <span className="text-xs px-2 py-0.5 rounded font-normal" style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}>
              {made.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {made.length === 0 ? (
            <p className="text-sm text-center py-8" style={muted}>No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                    {["Patient", "Referred on", "Status", "Reward", ""].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-xs font-semibold" style={muted}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {made.map((r) => {
                    const [label, color] = STATUS_LABEL[r.status]
                    return (
                      <tr key={r.id} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                        <td className="py-2.5 px-2">
                          <Link href={`/patients/${r.referee.id}`} className="font-medium hover:underline" style={{ color: BRAND_COLORS.bodyText }}>
                            {r.referee.fullName}
                          </Link>
                          <span className="block text-[11px] font-mono" style={muted}>{r.referee.patientId}</span>
                        </td>
                        <td className="py-2.5 px-2 text-xs" style={muted}>{formatDate(r.createdAt)}</td>
                        <td className="py-2.5 px-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}18`, color }}>{label}</span>
                        </td>
                        <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                          {r.rewardType ? (
                            <>
                              {rewardLabel(r.rewardType, r.rewardAmount, r.rewardNote)}
                              <span className="block text-[11px]" style={muted}>
                                {r.redeemedAt
                                  ? `Used ${formatDate(r.redeemedAt)}${r.redeemedNote ? ` — ${r.redeemedNote}` : ""}`
                                  : `Given ${r.grantedAt ? formatDate(r.grantedAt) : ""}${r.grantedBy ? ` by ${r.grantedBy.name}` : ""} · not used yet`}
                              </span>
                            </>
                          ) : (
                            <span style={muted}>—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {canReward && (r.status === "PENDING" || r.status === "QUALIFIED") && (
                            <GrantRewardDialog referralId={r.id} referrerName="this patient" refereeName={r.referee.fullName} />
                          )}
                          {canReward && r.status === "REWARDED" && !r.redeemedAt && r.rewardType !== "MONETARY" && (
                            <MarkRewardUsedButton referralId={r.id} patientId={patientId} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
