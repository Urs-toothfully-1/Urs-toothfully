import Link from "next/link"
import { referralService } from "@/server/services/referral.service"
import { formatDate } from "@/lib/utils"
import { Gift, UserPlus } from "lucide-react"

/** Consultation / treatment strip: who referred this patient, and rewards they can still use. */
export async function ReferralBanner({ patientId }: { patientId: string }) {
  const [referredBy, rewards] = await Promise.all([
    referralService.referredBy(patientId),
    referralService.availableRewards(patientId),
  ])
  if (!referredBy && rewards.length === 0) return null

  return (
    <div className="mb-3 rounded-lg border px-4 py-2.5 text-sm flex flex-wrap gap-x-6 gap-y-1.5" style={{ borderColor: "#BFDBFE", backgroundColor: "#EFF6FF", color: "#1E3A8A" }}>
      {referredBy && (
        <span className="flex items-center gap-1.5">
          <UserPlus className="h-4 w-4" />
          Referred by{" "}
          <Link href={`/patients/${referredBy.referrer.id}/referrals`} className="font-semibold hover:underline">
            {referredBy.referrer.fullName}
          </Link>
          <span className="text-xs opacity-80">({referredBy.referrer.patientId}) on {formatDate(referredBy.createdAt)}</span>
        </span>
      )}
      {rewards.length > 0 && (
        <Link href={`/patients/${patientId}/referrals`} className="flex items-center gap-1.5 hover:underline">
          <Gift className="h-4 w-4" />
          Unused reward{rewards.length > 1 ? "s" : ""}: <strong>{rewards.map((r) => r.label.split(" (")[0]).join(", ")}</strong>
        </Link>
      )}
    </div>
  )
}
