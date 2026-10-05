import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { referralService } from "@/server/services/referral.service"
import { ReferralPanel } from "@/components/referrals/ReferralPanel"
import { ReferrerPicker } from "@/components/referrals/ReferrerPicker"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gift, Link2, UserPlus } from "lucide-react"

export const metadata: Metadata = { title: "Referrals" }

type Props = { params: Promise<{ patientId: string }> }

export default async function PatientReferralsPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  const { patientId } = await params
  const canReward = session.role === "ADMIN" || session.role === "DOCTOR"
  const [code, patient, hasReferrer] = await Promise.all([
    referralService.ensureCode(patientId),
    prisma.patient.findUnique({ where: { id: patientId }, select: { mobile: true } }),
    prisma.referral.count({ where: { refereeId: patientId } }),
  ])
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://urstoothfully.org").replace(/\/$/, "")
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
          <CardContent className="space-y-1.5">
            <p className="text-2xl font-mono font-bold tracking-widest" style={{ color: BRAND_COLORS.primaryTeal }}>{code}</p>
            <p className="text-xs flex items-center gap-1.5 break-all" style={muted}>
              <Link2 className="h-3.5 w-3.5 flex-shrink-0" /> {siteUrl}/rewards/{code}
            </p>
            <p className="text-xs" style={muted}>
              Friends can use this link, the code, or this patient&apos;s mobile <strong>{patient?.mobile}</strong>.
            </p>
          </CardContent>
        </Card>

        {!hasReferrer && (
          <Card className="border-[#E0E3E5] bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                <UserPlus className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} /> Referred by
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs" style={muted}>Not recorded. Find the referrer by code or mobile:</p>
              <ReferrerPicker refereeId={patientId} />
            </CardContent>
          </Card>
        )}
      </div>

      <ReferralPanel patientId={patientId} canReward={canReward} defaultOpen />
    </div>
  )
}
