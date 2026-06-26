import { BRAND_COLORS } from "@/lib/constants"

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${BRAND_COLORS.primaryTeal}40`, borderTopColor: BRAND_COLORS.primaryTeal }}
        />
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>Loading…</p>
      </div>
    </div>
  )
}
