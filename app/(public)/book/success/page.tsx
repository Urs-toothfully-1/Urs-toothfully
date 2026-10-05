import { Metadata } from "next"
import Link from "next/link"
import { APP_NAME, CLINIC_HOURS, EMERGENCY_CONTACT } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { normalizeReferralCode } from "@/lib/referral-code"
import { publicName } from "@/lib/rewards"
import { CalendarCheck, Gift, Phone } from "lucide-react"

export const metadata: Metadata = { title: "Booking Complete", robots: { index: false, follow: false } }

type Props = { searchParams: Promise<{ name?: string; ref?: string }> }

export default async function BookSuccessPage({ searchParams }: Props) {
  const { name, ref } = await searchParams
  const code = ref ? normalizeReferralCode(ref) : ""
  const referrer = /^[A-Z0-9]{4,12}$/.test(code)
    ? await prisma.patient.findFirst({ where: { referralCode: code, isDeleted: false }, select: { fullName: true } })
    : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E0E3E5] shadow-sm overflow-hidden text-center">
        <div className="px-6 pt-10 pb-4">
          <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
            <CalendarCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#191C1E]">Booking complete!</h1>
          <p className="mt-2 text-sm text-[#404751] leading-relaxed">
            {name ? `Thank you, ${name}. ` : "Thank you. "}
            Our team at {APP_NAME} will call or WhatsApp you shortly to confirm your appointment date and time.
          </p>
        </div>

        {referrer && (
          <div className="mx-6 mb-4 rounded-xl p-4 text-left flex gap-3" style={{ background: "linear-gradient(135deg, #E6F4F2, #EEF6FB)" }}>
            <Gift className="h-5 w-5 flex-shrink-0 text-[#006B5F]" />
            <p className="text-sm text-[#1F3B4D]">
              Your referral from <strong>{publicName(referrer.fullName)}</strong> is saved. Your welcome reward will be applied at your visit.
            </p>
          </div>
        )}

        <div className="mx-6 mb-6 rounded-xl p-4 text-left" style={{ backgroundColor: "#F2F4F6" }}>
          <p className="text-xs font-semibold text-[#404751]">Clinic hours</p>
          <p className="text-xs text-[#707882] mt-1">{CLINIC_HOURS.weekday}</p>
          <p className="text-xs text-[#707882]">{CLINIC_HOURS.sunday} · {CLINIC_HOURS.closed}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#707882]">
            <Phone className="h-3.5 w-3.5" /> {EMERGENCY_CONTACT}
          </p>
        </div>

        <div className="px-6 pb-8">
          <Link href={referrer ? `/rewards/${code}` : "/book"} className="text-sm font-semibold" style={{ color: "#005E97" }}>
            Book another appointment
          </Link>
        </div>
      </div>
    </div>
  )
}
