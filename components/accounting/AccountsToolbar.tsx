"use client"

import { useRouter } from "next/navigation"
import { LEDGER_CATEGORIES } from "@/lib/ledger-categories"
import { BRAND_COLORS } from "@/lib/constants"
import { Building2 } from "lucide-react"

interface Current {
  branch: string // branch id or "all"
  category: string // category value or "all"
  from: string
  to: string
}

export function AccountsToolbar({
  branches,
  current,
}: {
  branches: { id: string; name: string }[]
  current: Current
}) {
  const router = useRouter()

  function go(over: Partial<Current>) {
    const merged = { ...current, ...over }
    const p = new URLSearchParams()
    if (merged.branch && merged.branch !== "all") p.set("branch", merged.branch)
    if (merged.category && merged.category !== "all") p.set("category", merged.category)
    p.set("from", merged.from)
    p.set("to", merged.to)
    router.push(`/admin/accounts?${p.toString()}`)
  }

  const tabs = [{ value: "all", label: "All" }, ...LEDGER_CATEGORIES]

  return (
    <div className="space-y-3">
      {/* Branch selector + date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: BRAND_COLORS.borderDivider }}>
            <Building2 className="h-3.5 w-3.5" /> Branch
          </label>
          <select
            value={current.branch}
            onChange={(e) => go({ branch: e.target.value })}
            className="h-9 min-w-44 rounded-md border border-[#E0E3E5] bg-white px-2.5 text-sm font-medium"
            style={{ color: BRAND_COLORS.bodyText }}
          >
            <option value="all">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: BRAND_COLORS.borderDivider }}>From</label>
          <input type="date" defaultValue={current.from} onChange={(e) => e.target.value && go({ from: e.target.value })}
            className="h-9 rounded-md border border-[#E0E3E5] bg-white px-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: BRAND_COLORS.borderDivider }}>To</label>
          <input type="date" defaultValue={current.to} onChange={(e) => e.target.value && go({ to: e.target.value })}
            className="h-9 rounded-md border border-[#E0E3E5] bg-white px-2 text-sm" />
        </div>
      </div>

      {/* Category quick-switch tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = current.category === t.value
          return (
            <button
              key={t.value}
              onClick={() => go({ category: t.value })}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={{
                backgroundColor: active ? BRAND_COLORS.primaryTeal : "white",
                color: active ? "white" : BRAND_COLORS.bodyText,
                borderColor: active ? BRAND_COLORS.primaryTeal : "#E0E3E5",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
