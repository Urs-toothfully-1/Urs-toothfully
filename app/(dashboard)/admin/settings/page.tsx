import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsMgmt } from "@/components/admin/SettingsMgmt"
import { BRAND_COLORS } from "@/lib/constants"

export const metadata: Metadata = { title: "System Settings" }
export const dynamic = "force-dynamic"

const GLOBAL_KEYS = [
  { key: "advance_percent", label: "Minimum Advance %", type: "number", hint: "Default: 20" },
  { key: "allow_discount", label: "Allow Discount on Estimates", type: "boolean", hint: "true or false" },
]

const BRANCH_KEYS = [
  { key: "consultation_fee", label: "Consultation Fee (₹)", type: "number", hint: "Default: 500" },
  { key: "queue_assignment_mode", label: "Queue Mode", type: "select", options: ["SPECIFIC_DOCTOR", "NEXT_AVAILABLE_DOCTOR"] },
  { key: "prescription_mode", label: "Prescription Mode", type: "select", options: ["PRINT_ONLY", "PARTIAL_DIGITAL", "FULL_DIGITAL"] },
]

export default async function SettingsPage() {
  await requireRole(["ADMIN"])

  // Single query for all data — avoids 20 sequential round-trips to Supabase
  const [branches, allSettings] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.systemSetting.findMany(),
  ])

  // Build maps from the single result set
  const globalSettings: Record<string, string> = {}
  const branchSettings: Record<string, Record<string, string>> = {}

  for (const s of allSettings) {
    if (!s.branchId) {
      globalSettings[s.key] = s.value
    } else {
      if (!branchSettings[s.branchId]) branchSettings[s.branchId] = {}
      branchSettings[s.branchId][s.key] = s.value
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>System Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Global and per-branch configuration
        </p>
      </div>
      <SettingsMgmt
        globalSettings={globalSettings}
        globalKeys={GLOBAL_KEYS as any}
        branchSettings={branchSettings}
        branchKeys={BRANCH_KEYS as any}
        branches={branches}
      />
    </div>
  )
}
