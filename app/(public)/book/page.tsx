import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { APP_NAME, APP_TAGLINE, CLINIC_HOURS, EMERGENCY_CONTACT } from "@/lib/constants"
import { BookingForm } from "@/components/booking/BookingForm"
import { Logo } from "@/components/shared/Logo"
import { Clock, Phone, ShieldCheck, Star } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Book an Appointment — ${APP_NAME}`,
  description: "Request a dental appointment at Ur's Toothfully. Pick your clinic and preferred date — we'll confirm your slot.",
}

export default async function BookPage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside
        className="relative overflow-hidden px-6 py-10 lg:px-12 lg:py-14 flex flex-col justify-between text-white"
        style={{ background: "linear-gradient(150deg, #005E97 0%, #00557f 45%, #006B5F 100%)" }}
      >
        {/* soft decorative blobs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />
        <div className="pointer-events-none absolute bottom-0 -left-10 h-52 w-52 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />

        <div className="relative">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" rounded="rounded-xl" />
            <div>
              <p className="text-lg font-bold leading-tight">{APP_NAME}</p>
              <p className="text-xs text-white/70">{APP_TAGLINE}</p>
            </div>
          </div>

          <h1 className="mt-10 text-3xl lg:text-4xl font-bold leading-tight max-w-sm">
            Book your visit in under a minute.
          </h1>
          <p className="mt-3 text-white/80 max-w-sm text-sm leading-relaxed">
            Tell us a little about you and pick a date. Our team confirms every request personally by call or WhatsApp.
          </p>

          <ul className="mt-8 space-y-3 max-w-sm">
            {[
              { icon: ShieldCheck, text: "Confirmed by our reception team" },
              { icon: Star, text: "Full mouth rehab & implant specialists" },
              { icon: Clock, text: CLINIC_HOURS.weekday },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 flex items-center gap-2 text-sm text-white/80">
          <Phone className="h-4 w-4" />
          Emergency? Call <span className="font-semibold text-white">{EMERGENCY_CONTACT}</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-10 lg:px-12" style={{ backgroundColor: "#F7F9FB" }}>
        <div className="w-full max-w-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#191C1E]">Request an appointment</h2>
            <p className="text-sm text-[#707882] mt-1">Fill in your details below — it only takes a moment.</p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E0E3E5] shadow-sm p-5 sm:p-7">
            <BookingForm branches={branches} />
          </div>
        </div>
      </main>
    </div>
  )
}
