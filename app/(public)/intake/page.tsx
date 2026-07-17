import { Metadata } from "next"
import { IntakeForm } from "@/components/intake/IntakeForm"
import { Logo } from "@/components/shared/Logo"
import { APP_NAME, APP_TAGLINE, BRAND_COLORS, CLINIC_HOURS } from "@/lib/constants"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patient Registration",
  description: "Register as a new patient at Ur's Toothfully. Fill in your details before your visit.",
}

export default async function IntakePage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, address: true, phone: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-center gap-3">
          <Logo className="h-11 w-11" rounded="rounded-xl" />
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
              {APP_NAME}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              {APP_TAGLINE}
            </p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-6">
            <h2 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
              New Patient Registration
            </h2>
            <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
              Please fill in your details before your visit. This saves time at the front desk.
              All information is confidential and secure.
            </p>
            <IntakeForm branches={branches} />
          </div>
        </div>

        {/* Branch info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(branches as { id: string; name: string; address: string; phone: string }[]).map((b) => (
            <div key={b.id} className="bg-white rounded-lg border border-[#E0E3E5] p-3 text-sm">
              <p className="font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>{b.name} Branch</p>
              <p className="mt-1 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{b.address}</p>
              <p className="mt-0.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{b.phone}</p>
            </div>
          ))}
        </div>

        {/* Hours */}
        <div className="mt-4 text-center text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          <p>{CLINIC_HOURS.weekday} · {CLINIC_HOURS.sunday} · {CLINIC_HOURS.closed}</p>
          <p className="mt-1">Emergency: 7890008331</p>
        </div>
      </main>
    </div>
  )
}
