import { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/constants"
import { Logo } from "@/components/shared/Logo"
import { Star, MessageCircle } from "lucide-react"

export const dynamic = "force-dynamic"
// Utility landing page (not marketing) — keep it out of search results. The root
// layout already sets noindex; this just makes the intent explicit.
export const metadata: Metadata = { title: "Leave a Review", robots: { index: false, follow: false } }

type Props = { params: Promise<{ branchId: string }> }

export default async function ReviewPage({ params }: Props) {
  const { branchId } = await params

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, isActive: true },
    select: { id: true, name: true, phone: true },
  })
  if (!branch) notFound()

  const reviewUrl = await settingsRepository.get("google_review_url", branch.id)
  // A private, non-gated fallback: patients who'd rather not post publicly can
  // message the branch directly. (Offered to everyone — this is NOT review gating.)
  const waDigits = branch.phone.replace(/\D/g, "")
  const waLink = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`Hi ${APP_NAME} (${branch.name}), I'd like to share some feedback about my visit.`)}`
    : null

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(160deg, #F2F7FA 0%, #EAF3F0 100%)" }}
    >
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm" style={{ borderColor: "#E0E3E5" }}>
        <div className="flex flex-col items-center gap-2">
          <Logo className="h-14 w-14" rounded="rounded-2xl" />
          <p className="text-lg font-bold" style={{ color: BRAND_COLORS.bodyText }}>{APP_NAME}</p>
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{branch.name} Branch · {APP_TAGLINE}</p>
        </div>

        <div className="mt-6 flex justify-center gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="h-7 w-7" style={{ color: "#F5B301", fill: "#F5B301" }} />
          ))}
        </div>

        <h1 className="mt-5 text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
          How was your visit?
        </h1>
        <p className="mt-2 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          Your feedback helps our team and other patients. It only takes a few seconds.
        </p>

        {reviewUrl ? (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            <Star className="h-4 w-4" style={{ fill: "currentColor" }} />
            Leave a Google review
          </a>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed px-4 py-3 text-sm" style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.borderDivider }}>
            Our review link isn&apos;t set up yet — please check back soon.
          </p>
        )}

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-slate-50"
            style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.bodyText }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Prefer to tell us privately?
          </a>
        )}

        <p className="mt-6 text-[11px] leading-relaxed" style={{ color: BRAND_COLORS.borderDivider }}>
          Thank you for choosing {APP_NAME}.
        </p>
      </div>
    </div>
  )
}
