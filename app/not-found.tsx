import Link from "next/link"
import { BRAND_COLORS, APP_NAME } from "@/lib/constants"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
      <div className="text-center space-y-4 max-w-md px-6">
        <h1 className="text-6xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>404</h1>
        <h2 className="text-xl font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Page Not Found</h2>
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/reception"
            className="px-5 py-2.5 rounded-md text-sm font-semibold text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
            Go to Reception
          </Link>
          <Link href="/patients"
            className="px-5 py-2.5 rounded-md text-sm font-medium border border-[#E0E3E5] bg-white"
            style={{ color: BRAND_COLORS.bodyText }}>
            Search Patients
          </Link>
        </div>
        <p className="text-xs pt-4" style={{ color: BRAND_COLORS.borderDivider }}>{APP_NAME}</p>
      </div>
    </div>
  )
}
