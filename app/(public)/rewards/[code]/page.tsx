import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { APP_NAME, CLINIC_HOURS } from "@/lib/constants"
import { normalizeReferralCode } from "@/lib/referral-code"
import { publicName } from "@/lib/rewards"
import { rewardService } from "@/server/services/reward.service"
import { BookingForm } from "@/components/booking/BookingForm"
import { ArrowButton, C, Eyebrow, LineArt, SiteBar, SiteFooter, serif } from "@/components/rewards/Editorial"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "You're invited",
  description: `A friend invited you to ${APP_NAME}. Book your first visit and claim your welcome reward.`,
  // Personal invite links — keep them out of search results.
  robots: { index: false, follow: false },
  openGraph: {
    title: `You're invited to ${APP_NAME}`,
    description: "A friend thinks you'll love your smile here. Book your first visit and claim your welcome reward.",
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
      <main className="min-h-screen flex flex-col" style={{ backgroundColor: C.ink, color: C.cream }}>
        <SiteBar />
        <div className="relative flex-1 flex items-center px-[6vw] py-20 overflow-hidden">
          <LineArt className="absolute -right-40 -bottom-40 h-[520px] w-[520px] opacity-30" />
          <div className="relative max-w-[620px]">
            <Eyebrow dot light>Invite not found</Eyebrow>
            <h1 className="mt-6 text-[44px] sm:text-[64px] leading-[1.08] font-medium tracking-[-0.03em]">
              This invite link <em className="not-italic" style={serif}>isn&rsquo;t valid.</em>
            </h1>
            <p className="mt-5 text-[16px] leading-[1.8]" style={{ color: "rgba(246,241,232,.8)" }}>
              Please check the link or code with the friend who shared it — or book directly, we&rsquo;d love to see you.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ArrowButton href="/rewards">Enter a code</ArrowButton>
              <ArrowButton href="/book">Book a consultation</ArrowButton>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const [campaigns, branches] = await Promise.all([
    rewardService.liveCampaigns(),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true }, orderBy: { name: "asc" } }),
  ])
  const name = publicName(referrer.fullName)
  const first = name.split(" ")[0]

  return (
    <main>
      {/* ── Invitation hero ───────────────────────────── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: C.ink, color: C.cream }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rewards/team.webp" alt="The team at Ur's Toothfully" className="absolute inset-0 h-full w-full object-cover object-[70%_40%]" style={{ filter: "saturate(.8)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(52,40,34,.97) 0%, rgba(52,40,34,.92) 40%, rgba(52,40,34,.4) 75%, rgba(52,40,34,.25)), linear-gradient(0deg, rgba(52,40,34,.9), transparent 55%)" }} />
        <div className="absolute inset-0 sm:hidden" style={{ backgroundColor: "rgba(52,40,34,.6)" }} />
        <LineArt className="absolute -left-40 -bottom-48 h-[520px] w-[520px] opacity-40" />
        <SiteBar />

        <div className="relative px-[6vw] pt-14 pb-16 sm:pt-20 sm:pb-20 max-w-[1500px]">
          <Eyebrow dot light>A personal invitation</Eyebrow>
          <h1 className="mt-6 max-w-[780px] text-[44px] leading-[1.06] sm:text-[68px] lg:text-[80px] font-medium tracking-[-0.03em]">
            You&rsquo;ve been invited<br />by <em className="not-italic" style={{ ...serif, color: "#e3cfae" }}>{name}</em>
          </h1>
          <p className="mt-6 max-w-[470px] text-[16px] leading-[1.8]" style={{ color: "rgba(246,241,232,.82)" }}>
            {first} trusts us with their smile and thought you would too. Book your first visit below — your invitation is saved automatically.
          </p>

          {/* Welcome reward */}
          <div className="mt-10 max-w-[620px] border-t" style={{ borderColor: "rgba(246,241,232,.22)" }}>
            <span className="block pt-6 text-[11px] tracking-[0.16em]" style={{ color: C.gold }}>YOUR WELCOME REWARD</span>
            {campaigns.length === 0 ? (
              <p className="mt-3 text-[24px] sm:text-[28px] leading-[1.35]" style={serif}>A thank-you chosen by your doctor at your first visit.</p>
            ) : (
              <ul className="mt-2">
                {campaigns.map((c) => (
                  <li key={c.id} className="py-4 border-b last:border-b-0" style={{ borderColor: "rgba(246,241,232,.14)" }}>
                    <p className="text-[24px] sm:text-[30px] leading-[1.3]" style={serif}>{c.refereeOffer}</p>
                    <p className="mt-1.5 text-[12px] tracking-[0.1em]" style={{ color: "rgba(246,241,232,.6)" }}>
                      {c.name.toUpperCase()}{c.terms ? ` · ${c.terms}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-10">
            <ArrowButton href="#book">Book my first visit</ArrowButton>
          </div>
        </div>
      </section>

      {/* ── Booking ───────────────────────────────────── */}
      <section id="book" className="scroll-mt-4 px-[6vw] py-20 sm:py-24 max-w-[1500px] mx-auto">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-[7vw]">
          <div>
            <Eyebrow>Book your first visit</Eyebrow>
            <h2 className="mt-5 text-[40px] sm:text-[54px] leading-[1.08] font-medium tracking-[-0.03em]">
              Pick a clinic.<br /><em className="not-italic" style={serif}>We&rsquo;ll do the rest.</em>
            </h2>
            <p className="mt-6 max-w-[420px] text-[16px] leading-[1.85]" style={{ color: C.muted }}>
              Tell us when suits you. Our team will call or WhatsApp you to confirm a time with the right specialist.
            </p>
            <dl className="mt-10 border-t max-w-[420px]" style={{ borderColor: "rgba(52,40,34,.2)" }}>
              {[
                ["Monday – Saturday", CLINIC_HOURS.weekday.replace(/^Mon[^:]*:\s*/i, "")],
                ["Sunday", CLINIC_HOURS.sunday.replace(/^Sun[^:]*:\s*/i, "")],
                [CLINIC_HOURS.closed.split(":")[0], CLINIC_HOURS.closed.split(":").slice(1).join(":").trim()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 py-4 border-b text-[14px]" style={{ borderColor: "rgba(52,40,34,.2)" }}>
                  <dt style={{ color: C.muted }}>{k}</dt><dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white/60 border p-6 sm:p-9" style={{ borderColor: "rgba(52,40,34,.15)" }}>
            <BookingForm branches={branches} referralCode={code} editorial />
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
