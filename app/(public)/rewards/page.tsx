import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { APP_NAME, APP_TAGLINE } from "@/lib/constants"
import { normalizeReferralCode } from "@/lib/referral-code"
import { themeOf } from "@/lib/rewards"
import { rewardService } from "@/server/services/reward.service"
import { Logo } from "@/components/shared/Logo"
import { ArrowRight, Gift, Sparkles, UserPlus } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Refer & Earn",
  description: `Refer a friend to ${APP_NAME} — you both get rewarded.`,
}

/** /rewards without a code: explains the programme, shows live offers, takes an invite code. */
export default async function RewardsLandingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  if (code) {
    const c = normalizeReferralCode(code)
    if (/^[A-Z0-9]{4,12}$/.test(c)) redirect(`/rewards/${c}`)
  }
  const campaigns = await rewardService.liveCampaigns()

  return (
    <div className="min-h-screen px-4 py-10 lg:py-16 text-white" style={{ background: "linear-gradient(150deg, #003E66 0%, #005E97 45%, #006B5F 100%)" }}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <Logo className="h-11 w-11" rounded="rounded-xl" />
          <div>
            <p className="text-lg font-bold leading-tight">{APP_NAME}</p>
            <p className="text-xs text-white/70">{APP_TAGLINE}</p>
          </div>
        </div>

        <h1 className="mt-10 text-3xl lg:text-4xl font-bold leading-tight">Refer a friend. <span className="text-[#C7F07A]">You both get rewarded.</span></h1>
        <p className="mt-3 text-white/80 max-w-xl text-sm leading-relaxed">
          Every friend you refer earns a reward for you and a welcome reward for them, once they visit. Ask at the clinic for your personal invite link.
        </p>

        {/* Have an invite code? */}
        <form action="/rewards" className="mt-8 flex flex-col sm:flex-row gap-2 max-w-md">
          <input
            name="code" required maxLength={12} placeholder="Have an invite code? e.g. 82GSPX"
            className="h-12 flex-1 rounded-xl bg-white px-4 text-sm font-mono uppercase tracking-widest text-[#191C1E] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#C7F07A]"
          />
          <button className="h-12 rounded-xl bg-[#C7F07A] px-5 text-sm font-semibold text-[#14361F] flex items-center justify-center gap-1.5 hover:brightness-105">
            Open invite <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-10 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          <Sparkles className="h-3.5 w-3.5" /> Running now
        </p>
        {campaigns.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-white/10 ring-1 ring-white/20 p-5 max-w-xl">
            <p className="font-semibold">Rewards are decided by our doctors</p>
            <p className="text-sm text-white/80 mt-1">Refer a friend and ask at your next visit — every referral counts.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => {
              const t = themeOf(c.theme)
              return (
                <div key={c.id} className="overflow-hidden rounded-2xl bg-white text-[#191C1E] shadow-lg">
                  <div className="px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
                    <p className="font-bold">{c.name}</p>
                    {c.tagline && <p className="text-xs text-white/85">{c.tagline}</p>}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="p-3">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.ink }}><Gift className="h-3 w-3" /> You get</p>
                      <p className="mt-1 text-sm font-medium leading-snug">{c.referrerOffer}</p>
                    </div>
                    <div className="p-3">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.ink }}><UserPlus className="h-3 w-3" /> Your friend gets</p>
                      <p className="mt-1 text-sm font-medium leading-snug">{c.refereeOffer}</p>
                    </div>
                  </div>
                  {c.terms && <p className="px-3 pb-3 text-[11px] text-gray-400">{c.terms}</p>}
                </div>
              )
            })}
          </div>
        )}

        <Link href="/book" className="mt-10 inline-flex h-11 items-center gap-1.5 rounded-xl bg-white/15 px-5 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/20">
          Book an appointment <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
