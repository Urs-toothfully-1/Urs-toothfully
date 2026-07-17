import { Metadata } from "next"
import Link from "next/link"
import { APP_NAME, CLINIC_HOURS, EMERGENCY_CONTACT } from "@/lib/constants"
import { CalendarCheck, Phone } from "lucide-react"

export const metadata: Metadata = { title: `Request Received — ${APP_NAME}` }

type Props = { searchParams: Promise<{ name?: string }> }

export default async function BookSuccessPage({ searchParams }: Props) {
  const { name } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F7F9FB" }}>
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E0E3E5] shadow-sm overflow-hidden text-center">
        <div className="px-6 pt-10 pb-4">
          <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #005E97, #006B5F)" }}>
            <CalendarCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#191C1E]">Request received!</h1>
          <p className="mt-2 text-sm text-[#404751] leading-relaxed">
            {name ? `Thank you, ${name}. ` : "Thank you. "}
            Our team at {APP_NAME} will call or WhatsApp you shortly to confirm your appointment date and time.
          </p>
        </div>

        <div className="mx-6 mb-6 rounded-xl p-4 text-left" style={{ backgroundColor: "#F2F4F6" }}>
          <p className="text-xs font-semibold text-[#404751]">Clinic hours</p>
          <p className="text-xs text-[#707882] mt-1">{CLINIC_HOURS.weekday}</p>
          <p className="text-xs text-[#707882]">{CLINIC_HOURS.sunday} · {CLINIC_HOURS.closed}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#707882]">
            <Phone className="h-3.5 w-3.5" /> {EMERGENCY_CONTACT}
          </p>
        </div>

        <div className="px-6 pb-8">
          <Link href="/book" className="text-sm font-semibold" style={{ color: "#005E97" }}>
            Book another appointment
          </Link>
        </div>
      </div>
    </div>
  )
}
