import { Metadata } from "next"
import { redirect } from "next/navigation"
import { APP_NAME } from "@/lib/constants"
import { normalizeReferralCode } from "@/lib/referral-code"
import { rewardService } from "@/server/services/reward.service"
import { ArrowButton, C, Eyebrow, LineArt, SiteBar, SiteFooter, serif } from "@/components/rewards/Editorial"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "The Referral Circle",
  description: `Refer a friend to ${APP_NAME} — when they visit, you are both rewarded.`,
  alternates: { canonical: "/rewards" },
}

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" })

/** /rewards — the programme, the offers running now, and a box to open an invite by code. */
export default async function RewardsLandingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const typed = code ? normalizeReferralCode(code) : ""
  if (typed && /^[A-Z0-9]{4,12}$/.test(typed)) redirect(`/rewards/${typed}`)
  const campaigns = await rewardService.liveCampaigns()

  return (
    <main>
      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: C.ink, color: C.cream }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rewards/team.webp" alt="The team at Ur's Toothfully" className="absolute inset-0 h-full w-full object-cover object-[70%_40%]" style={{ filter: "saturate(.8)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(52,40,34,.97) 0%, rgba(52,40,34,.9) 38%, rgba(52,40,34,.35) 75%, rgba(52,40,34,.2)), linear-gradient(0deg, rgba(52,40,34,.85), transparent 50%)" }} />
        <div className="absolute inset-0 sm:hidden" style={{ backgroundColor: "rgba(52,40,34,.6)" }} />
        <LineArt className="absolute -left-40 -bottom-40 h-[520px] w-[520px] opacity-40" />

        <SiteBar />

        <div className="relative px-[6vw] pt-16 pb-14 sm:pt-24 sm:pb-20 max-w-[1500px]">
          <Eyebrow dot light>The Ur&rsquo;s Toothfully Referral Circle</Eyebrow>
          <h1 className="mt-6 max-w-[760px] text-[46px] leading-[1.06] sm:text-[72px] lg:text-[86px] font-medium tracking-[-0.03em]">
            Share your smile.<br />
            <em className="not-italic" style={serif}>You&rsquo;re both rewarded.</em>
          </h1>
          <p className="mt-6 max-w-[460px] text-[16px] leading-[1.8]" style={{ color: "rgba(246,241,232,.82)" }}>
            When a friend you refer visits us, you each earn a point. Your doctor turns points into a reward made for you — at your next visit.
          </p>

          {/* Invite code */}
          <form action="/rewards" className="mt-10 max-w-[560px]">
            <label htmlFor="code" className="block text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: C.gold }}>Received an invite code?</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="code" name="code" required maxLength={12} autoComplete="off" spellCheck={false} placeholder="e.g. 82GSPX"
                className="h-[56px] flex-1 rounded-[2px] bg-transparent px-5 text-[18px] uppercase tracking-[0.3em] placeholder:normal-case placeholder:tracking-normal placeholder:text-[15px] focus:outline-none"
                style={{ border: "1px solid rgba(246,241,232,.45)", color: C.cream }}
              />
              <ArrowButton type="submit">Open my invite</ArrowButton>
            </div>
            {code && <p className="mt-3 text-[13px]" style={{ color: "#e7b9a0" }}>That doesn&rsquo;t look like an invite code — it has 6 letters and numbers.</p>}
          </form>
        </div>

        <div className="relative mx-[6vw] hidden sm:flex flex-wrap justify-between gap-x-8 gap-y-3 border-t py-6 text-[12px] tracking-[0.12em]" style={{ borderColor: "rgba(246,241,232,.2)" }}>
          {["YOUR FRIEND BOOKS", "THEY VISIT US", "YOU BOTH EARN A POINT", "YOUR DOCTOR CHOOSES THE REWARD"].map((t, i) => (
            <span key={t} className="flex items-center gap-3">{i > 0 && <span style={{ color: C.gold }}>✦</span>}{t}</span>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section className="px-[6vw] py-20 sm:py-28 max-w-[1500px] mx-auto">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-[8vw] items-end">
          <div>
            <Eyebrow>01 — How it works</Eyebrow>
            <h2 className="mt-5 text-[40px] sm:text-[56px] leading-[1.08] font-medium tracking-[-0.03em]">
              Good care travels<br /><em className="not-italic" style={serif}>by word of mouth.</em>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.85] max-w-[520px]" style={{ color: C.muted }}>
            Most of our patients come to us because someone they trust did first. The Referral Circle is our way of saying thank you — to you, and to the friend you bring.
          </p>
        </div>
        <ol className="mt-14 grid sm:grid-cols-3 border-t" style={{ borderColor: "rgba(52,40,34,.2)" }}>
          {[
            ["Share your link", "Ask at the clinic for your personal invite link, or give friends your mobile number or code."],
            ["They visit us", "Your friend books through your link and comes in for a consultation at any of our three clinics."],
            ["You’re both rewarded", "Each of you earns a point. At your next visit your doctor turns points into a reward for you."],
          ].map(([t, d], i) => (
            <li key={t} className={`pt-8 pb-2 sm:pr-10 ${i > 0 ? "sm:pl-10 sm:border-l" : ""} border-b sm:border-b-0`} style={{ borderColor: "rgba(52,40,34,.2)" }}>
              <span className="text-[13px] tracking-[0.12em]" style={{ color: C.gold }}>0{i + 1}</span>
              <h3 className="mt-3 text-[26px] font-medium tracking-[-0.02em]">{t}</h3>
              <p className="mt-3 mb-8 text-[15px] leading-[1.8]" style={{ color: C.muted }}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Running now ───────────────────────────────── */}
      <section style={{ backgroundColor: C.cream2 }}>
        <div className="px-[6vw] py-20 sm:py-28 max-w-[1500px] mx-auto">
          <Eyebrow>02 — Running now</Eyebrow>
          <h2 className="mt-5 text-[40px] sm:text-[56px] leading-[1.08] font-medium tracking-[-0.03em]">
            This season&rsquo;s <em className="not-italic" style={serif}>thank-you.</em>
          </h2>

          {campaigns.length === 0 ? (
            <div className="mt-12 border-t border-b py-10 max-w-[720px]" style={{ borderColor: "rgba(52,40,34,.2)" }}>
              <p className="text-[26px] leading-[1.4]" style={serif}>Every referral is rewarded — your doctor chooses something right for you at your next visit.</p>
            </div>
          ) : (
            <div className={`mt-12 grid gap-5 ${campaigns.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {campaigns.map((c) => (
                <article key={c.id} className="relative overflow-hidden" style={{ backgroundColor: C.ink, color: C.cream }}>
                  <LineArt className="absolute -right-24 -top-24 h-[300px] w-[300px] opacity-30" />
                  <div className="relative p-8 sm:p-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Eyebrow dot light>{c.name}</Eyebrow>
                      <span className="text-[11px] tracking-[0.12em]" style={{ color: "rgba(246,241,232,.6)" }}>
                        {c.endsAt ? `UNTIL ${fmt(c.endsAt).toUpperCase()}` : "ONGOING"}
                      </span>
                    </div>
                    {c.tagline && <p className="mt-4 text-[28px] sm:text-[32px] leading-[1.25]" style={serif}>{c.tagline}</p>}
                    <div className="mt-8 grid sm:grid-cols-2 border-t" style={{ borderColor: "rgba(246,241,232,.2)" }}>
                      <div className="pt-6 sm:pr-6">
                        <span className="text-[11px] tracking-[0.14em]" style={{ color: C.gold }}>YOU RECEIVE</span>
                        <p className="mt-2 text-[17px] leading-[1.6]">{c.referrerOffer}</p>
                      </div>
                      <div className="pt-6 sm:pl-6 sm:border-l" style={{ borderColor: "rgba(246,241,232,.2)" }}>
                        <span className="text-[11px] tracking-[0.14em]" style={{ color: C.gold }}>YOUR FRIEND RECEIVES</span>
                        <p className="mt-2 text-[17px] leading-[1.6]">{c.refereeOffer}</p>
                      </div>
                    </div>
                    {c.terms && <p className="mt-7 text-[12px] leading-[1.7]" style={{ color: "rgba(246,241,232,.55)" }}>{c.terms}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Closing ───────────────────────────────────── */}
      <section className="relative overflow-hidden px-[6vw] py-20 sm:py-24" style={{ backgroundColor: C.ink, color: C.cream }}>
        <LineArt className="absolute -right-32 -bottom-48 h-[520px] w-[520px] opacity-30" />
        <div className="relative max-w-[1500px] mx-auto flex flex-wrap items-end justify-between gap-8">
          <h2 className="text-[38px] sm:text-[54px] leading-[1.1] font-medium tracking-[-0.03em] max-w-[680px]">
            Ready for your own visit? <em className="not-italic" style={serif}>We&rsquo;d love to meet you.</em>
          </h2>
          <ArrowButton href="/book">Book a consultation</ArrowButton>
        </div>
      </section>
      <SiteFooter />
    </main>
  )
}
