import { Metadata } from "next"
import { APP_NAME, BRAND_COLORS } from "@/lib/constants"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: `Registration Successful — ${APP_NAME}` }

type Props = { searchParams: Promise<{ id?: string; name?: string }> }

export default async function IntakeSuccessPage({ searchParams }: Props) {
  const { id, name } = await searchParams

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
      <div className="max-w-md w-full bg-white rounded-xl border border-[#E0E3E5] shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.secondaryGreen }} />
        <div className="px-6 py-8 text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 mx-auto" style={{ color: BRAND_COLORS.secondaryGreen }} />

          <div>
            <h1 className="text-2xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
              Registration Successful!
            </h1>
            {name && (
              <p className="mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                Welcome, {name}
              </p>
            )}
          </div>

          {id && (
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: BRAND_COLORS.lightBackground }}
            >
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                Your Patient ID
              </p>
              <p
                className="text-2xl font-bold font-mono mt-1 tracking-wider"
                style={{ color: BRAND_COLORS.primaryTeal }}
              >
                {id}
              </p>
              <p className="text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
                Please note this ID. You can use it to check in at the front desk.
              </p>
            </div>
          )}

          <div className="space-y-2 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
            <p>✓ Your details have been saved securely</p>
            <p>✓ Please show this ID at the front desk when you arrive</p>
            <p>✓ Our team will verify your information</p>
          </div>

          <div
            className="rounded-lg p-3 text-sm"
            style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}10`, color: BRAND_COLORS.primaryTeal }}
          >
            <p className="font-semibold">Next Step</p>
            <p className="text-xs mt-1" style={{ color: BRAND_COLORS.bodyText }}>
              Visit any of our branches during clinic hours. Our receptionist will
              find your record instantly using your Patient ID or mobile number.
            </p>
          </div>

          <Link
            href="/intake"
            className="block text-xs hover:underline"
            style={{ color: BRAND_COLORS.borderDivider }}
          >
            Register another patient
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: BRAND_COLORS.borderDivider }}>
        {APP_NAME} · Outram · New Alipore · Salt Lake
      </p>
    </div>
  )
}
