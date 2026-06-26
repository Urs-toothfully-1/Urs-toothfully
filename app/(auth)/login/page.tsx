import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { ROUTES, APP_NAME, APP_TAGLINE, CLINIC_HOURS } from "@/lib/constants"
import { LoginForm } from "@/components/auth/LoginForm"
import { MapPin, Clock } from "lucide-react"

export const metadata: Metadata = { title: "Login — Ur's Toothfully" }

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    const dest = session.role === "ADMIN" ? ROUTES.admin
      : session.role === "DOCTOR" ? ROUTES.doctor
      : ROUTES.reception
    redirect(dest)
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1F5F9" }}>
      {/* ── Left panel — brand ─────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0C1825 0%, #0F2744 50%, #0891B2 150%)" }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 h-80 w-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #0EA5E9, transparent)" }}
        />
        <div
          className="absolute bottom-0 -left-16 h-64 w-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #22D3EE, transparent)" }}
        />

        {/* Top — logo + name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-lg font-bold"
              style={{ background: "linear-gradient(135deg, #0891B2, #0EA5E9)" }}
            >
              T
            </div>
            <div>
              <p className="text-white text-lg font-bold leading-tight">{APP_NAME}</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Clinic Management System</p>
            </div>
          </div>

          <div className="space-y-1 mb-8">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Full Mouth<br />Rehabilitation &<br />Implant Centre
            </h2>
            <div className="h-1 w-12 rounded-full mt-4" style={{ backgroundColor: "#0EA5E9" }} />
          </div>

          {/* Branches */}
          <div className="space-y-3">
            {[
              { branch: "Outram", address: "1B Outram Street, Kolkata – 700 017" },
              { branch: "New Alipore", address: "643B, Block-O, New Alipore, Kolkata – 700 053" },
              { branch: "Salt Lake", address: "AL16, Sector II, Bidhannagar, Kolkata – 700 091" },
            ].map((b) => (
              <div key={b.branch} className="flex items-start gap-2.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#0EA5E9" }} />
                <div>
                  <p className="text-sm font-semibold text-white">{b.branch}</p>
                  <p className="text-xs" style={{ color: "#64748B" }}>{b.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — hours */}
        <div className="relative z-10">
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5" style={{ color: "#0EA5E9" }} />
              <span className="text-xs font-semibold text-white">Clinic Hours</span>
            </div>
            <p className="text-xs" style={{ color: "#94A3B8" }}>{CLINIC_HOURS.weekday}</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>{CLINIC_HOURS.sunday}</p>
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>{CLINIC_HOURS.closed}</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg, #0891B2, #0EA5E9)" }}
          >
            T
          </div>
          <div>
            <p className="font-bold" style={{ color: "#0F172A" }}>{APP_NAME}</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Welcome back</h1>
            <p className="text-sm mt-1" style={{ color: "#64748B" }}>
              Sign in to your staff account
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-8"
            style={{
              backgroundColor: "#FFFFFF",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
              border: "1px solid #E2E8F0",
            }}
          >
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: "#94A3B8" }}>
            Staff access only · Unauthorized use is prohibited
          </p>
        </div>
      </div>
    </div>
  )
}
