import { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { APP_NAME, APP_TAGLINE, EMERGENCY_CONTACT } from "@/lib/constants"
import { normalizeReferralCode } from "@/lib/referral-code"
import { publicName, themeOf } from "@/lib/rewards"
import { rewardService } from "@/server/services/reward.service"
import { BookingForm } from "@/components/booking/BookingForm"
import { Logo } from "@/components/shared/Logo"
import { Gift, Heart, Phone, ShieldCheck, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "You're invited",
  description: `A friend invited you to ${APP_NAME}. Book your visit and claim your referral reward.`,
  // Personal invite links — keep them out of search results.
  robots: { index: false, follow: false },
  openGraph: {
    title: `You're invited to ${APP_NAME}`,
    description: "A friend thinks you'll love your smile here. Book your visit and claim your welcome reward.",
    siteName: APP_NAME,
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: APP_NAME }],
  },
}

type Props = { params: Promise<{ code: string }> }

export default async function RewardsInvitePage({ params }: Props) {
  const { code: raw } = await params
  const code = normalizeReferralCode(raw)
  const referrer = /^[A-Z0-9]{4,12}$/.test(code)
    ? await prisma.patient.findFirst({ where: { referralCode: code, isDeleted: false }, select: { fullName: true } })
    : null

  if (!referrer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F9FB" }}>
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E0E3E5] shadow-sm p-8 text-center">
          <Gift className="h-10 w-10 mx-auto text-gray-300" />
          <h1 className="mt-4 text-xl font-bold text-[#191C1E]">This invite link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-[#707882]">Please check the link with the friend who shared it — or book directly, we&apos;d love to see you.</p>
          <Link href="/book" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
            Book an appointment
          </Link>
        </div>
      </div>
    )
  }

  const [campaigns, branches] = await Promise.all([
    rewardService.liveCampaigns(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true }, orderBy: { name: "asc" } }),
  ])
  const name = publicName(referrer.fullName)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Invitation panel */}
      <aside className="relative overflow-hidden px-6 py-10 lg:px-12 lg:py-14 text-white flex flex-col"
        style={{ background: "linear-gradient(150deg, #003E66 0%, #005E97 45%, #006B5F 100%)" }}>
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 65%)" }} />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #8DC21F 0%, transparent 65%)" }} />

        <div className="relative flex items-center gap-3">
          <Logo className="h-11 w-11" rounded="rounded-xl" />
          <div>
            <p className="text-lg font-bold leading-tight">{APP_NAME}</p>
            <p className="text-xs text-white/70">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="relative mt-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
            <Heart className="h-3.5 w-3.5" /> Personal invitation
          </span>
          <h1 className="mt-4 text-3xl lg:text-4xl font-bold leading-tight max-w-md">
            You&apos;ve been referred by <span className="text-[#C7F07A]">{name}</span>
          </h1>
          <p className="mt-3 text-white/80 max-w-md text-sm leading-relaxed">
            {name.split(" ")[0]} trusts us with their smile and thought you would too. Book your first visit below — your referral is saved automatically.
          </p>
        </div>

        <div className="relative mt-8 space-y-3 max-w-md">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            <Sparkles className="h-3.5 w-3.5" /> Your welcome reward
          </p>
          {campaigns.length === 0 ? (
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur p-4">
              <p className="font-semibold">A thank-you from our doctors</p>
              <p className="text-sm text-white/80 mt-1">Your referral reward is decided by your doctor at your visit.</p>
            </div>
          ) : (
            campaigns.map((c) => {
              const t = themeOf(c.theme)
              return (
                <div key={c.id} className="relative overflow-hidden rounded-2xl bg-white text-[#191C1E] shadow-lg">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${t.from}, ${t.to})` }} />
                  <div className="p-4 flex gap-3">
                    <span className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
                      <Gift className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: t.ink }}>{c.name}</p>
                      <p className="mt-0.5 font-bold text-base leading-snug">{c.refereeOffer}</p>
                      {c.tagline && <p className="mt-0.5 text-xs text-[#707882]">{c.tagline}</p>}
                      {c.terms && <p className="mt-1.5 text-[11px] text-[#9AA1A9] leading-relaxed">{c.terms}</p>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="relative mt-auto pt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Confirmed personally by our team</span>
          <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {EMERGENCY_CONTACT}</span>
        </div>
      </aside>

      {/* Booking */}
      <main className="flex items-center justify-center px-4 py-10 lg:px-12" style={{ backgroundColor: "#F7F9FB" }}>
        <div className="w-full max-w-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#191C1E]">Book your first visit</h2>
            <p className="text-sm text-[#707882] mt-1">Pick a clinic and a date — we&apos;ll call or WhatsApp you to confirm.</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E0E3E5] shadow-sm p-5 sm:p-7">
            <BookingForm branches={branches} referralCode={code} />
          </div>
        </div>
      </main>
    </div>
  )
}
