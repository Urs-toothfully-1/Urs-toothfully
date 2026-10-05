import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { CLINIC_HOURS, EMERGENCY_CONTACT } from "@/lib/constants"
import { normalizeReferralCode } from "@/lib/referral-code"
import { publicName } from "@/lib/rewards"
import { ArrowButton, C, Eyebrow, LineArt, SiteBar, serif } from "@/components/rewards/Editorial"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Booking complete", robots: { index: false, follow: false } }

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ name?: string }> }

/** After booking from an invite: confirmation + the referral is saved. */
export default async function InviteBookedPage({ params, searchParams }: Props) {
  const [{ code: raw }, { name }] = await Promise.all([params, searchParams])
  const code = normalizeReferralCode(raw)
  const referrer = /^[A-Z0-9]{4,12}$/.test(code)
    ? await prisma.patient.findFirst({ where: { referralCode: code, isDeleted: false }, select: { fullName: true } })
    : null
  const guest = name?.trim().split(/\s+/)[0]?.slice(0, 40)

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: C.ink, color: C.cream }}>
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rewards/team.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%]" style={{ filter: "saturate(.75)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(52,40,34,.97), rgba(52,40,34,.88) 50%, rgba(52,40,34,.55)), linear-gradient(0deg, rgba(52,40,34,.9), transparent 60%)" }} />
        <LineArt className="absolute -left-40 -bottom-40 h-[520px] w-[520px] opacity-40" />
        <SiteBar />

        <div className="relative flex-1 flex items-center px-[6vw] py-16">
          <div className="max-w-[720px]">
            <span className="grid h-14 w-14 place-items-center border text-[22px]" style={{ borderColor: C.gold, color: C.gold }} aria-hidden>✦</span>
            <Eyebrow dot light className="mt-8">Booking complete</Eyebrow>
            <h1 className="mt-5 text-[44px] sm:text-[68px] leading-[1.06] font-medium tracking-[-0.03em]">
              {guest ? <>Thank you, {guest}.</> : <>Thank you.</>}<br />
              <em className="not-italic" style={serif}>We&rsquo;ll be in touch shortly.</em>
            </h1>
            <p className="mt-6 max-w-[500px] text-[16px] leading-[1.8]" style={{ color: "rgba(246,241,232,.82)" }}>
              Our team will call or WhatsApp you to confirm your appointment date and time.
            </p>

            {referrer && (
              <div className="mt-10 border-t border-b py-6 max-w-[560px]" style={{ borderColor: "rgba(246,241,232,.22)" }}>
                <span className="text-[11px] tracking-[0.16em]" style={{ color: C.gold }}>YOUR INVITATION IS SAVED</span>
                <p className="mt-2 text-[22px] sm:text-[26px] leading-[1.4]" style={serif}>
                  Invited by {publicName(referrer.fullName)} — your welcome reward will be applied at your visit.
                </p>
              </div>
            )}

            <div className="mt-10 grid sm:grid-cols-3 gap-6 text-[13px] max-w-[640px]" style={{ color: "rgba(246,241,232,.75)" }}>
              <div><span className="block text-[11px] tracking-[0.14em]" style={{ color: C.gold }}>WEEKDAYS</span>{CLINIC_HOURS.weekday}</div>
              <div><span className="block text-[11px] tracking-[0.14em]" style={{ color: C.gold }}>SUNDAY</span>{CLINIC_HOURS.sunday}</div>
              <div><span className="block text-[11px] tracking-[0.14em]" style={{ color: C.gold }}>CALL US</span><a href={`tel:${EMERGENCY_CONTACT}`}>{EMERGENCY_CONTACT}</a></div>
            </div>

            <div className="mt-10">
              <ArrowButton href="https://urstoothfully.org" external>Visit urstoothfully.org</ArrowButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
