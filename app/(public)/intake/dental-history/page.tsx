import { Metadata } from "next"
import { redirect } from "next/navigation"
import { APP_NAME, BRAND_COLORS } from "@/lib/constants"
import { IntakeDentalHistoryForm } from "@/components/intake/IntakeDentalHistoryForm"
import { ClipboardList } from "lucide-react"

export const metadata: Metadata = {
  title: `Medical History — ${APP_NAME}`,
}

type Props = { searchParams: Promise<{ patientId?: string; name?: string }> }

export default async function IntakeDentalHistoryPage({ searchParams }: Props) {
  const { patientId, name } = await searchParams

  if (!patientId) redirect("/intake")

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <div className="max-w-2xl mx-auto px-4 py-5 text-center">
          <h1 className="text-2xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
            {APP_NAME}
          </h1>
          <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
            Step 2 of 2 — Medical &amp; Dental History
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Patient ID banner */}
        <div
          className="mb-4 rounded-lg px-4 py-3 flex items-center gap-3 text-sm"
          style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}12`, color: BRAND_COLORS.primaryTeal }}
        >
          <ClipboardList className="h-4 w-4 flex-shrink-0" />
          <span>
            Registering <strong>{name}</strong> · Patient ID:{" "}
            <strong className="font-mono">{patientId}</strong>
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />
          <div className="px-6 py-6">
            <h2 className="text-xl font-bold mb-1" style={{ color: BRAND_COLORS.bodyText }}>
              Medical &amp; Dental History
            </h2>
            <p className="text-sm mb-6" style={{ color: BRAND_COLORS.borderDivider }}>
              This information helps our doctors provide you with safe and personalised care.
              All information is confidential.
            </p>

            <IntakeDentalHistoryForm patientId={patientId} patientName={name ?? ""} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
          🔒 Your information is stored securely and used only for your dental care at{" "}
          <strong>Ur&apos;s Toothfully</strong>.
        </p>
      </main>
    </div>
  )
}
