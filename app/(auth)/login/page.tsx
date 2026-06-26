import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { LoginForm } from "@/components/auth/LoginForm"
import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/constants"

export const metadata: Metadata = {
  title: "Login",
}

export default async function LoginPage() {
  // Redirect if already logged in
  const session = await getSession()
  if (session) {
    const dest = session.role === "ADMIN" ? ROUTES.admin
      : session.role === "DOCTOR" ? ROUTES.doctor
      : ROUTES.reception
    redirect(dest)
  }
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: BRAND_COLORS.lightBackground }}
    >
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-[#CCCCCC] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />

        <div className="px-8 py-10">
          {/* Clinic identity */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              {APP_NAME}
            </h1>
            <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
              {APP_TAGLINE}
            </p>
          </div>

          {/* Divider */}
          <div
            className="border-t mb-8"
            style={{ borderColor: BRAND_COLORS.lightBackground }}
          />

          <LoginForm />
        </div>

        {/* Footer bar */}
        <div
          className="px-8 py-3 text-center text-xs"
          style={{
            backgroundColor: BRAND_COLORS.lightBackground,
            color: BRAND_COLORS.borderDivider,
          }}
        >
          Staff access only · Unauthorized use is prohibited
        </div>
      </div>

      {/* Clinic branches */}
      <p className="mt-6 text-xs text-center" style={{ color: BRAND_COLORS.borderDivider }}>
        Outram · New Alipore · Salt Lake
      </p>
    </div>
  )
}
