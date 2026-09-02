"use client"

import { useTransition, useState, useEffect } from "react"
import { updateSettingAction } from "@/actions/settings"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Save, CheckCircle2, Globe, Building2, Copy } from "lucide-react"
import { toast } from "sonner"

/** Shows the branch's public review-page URL (for QR codes / receipts) + copy. */
function ReviewLinkRow({ branchId }: { branchId: string }) {
  const [origin, setOrigin] = useState("")
  useEffect(() => setOrigin(window.location.origin), [])
  const path = `/review/${branchId}`
  const url = origin ? `${origin}${path}` : path
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>Public review page</p>
        <p className="text-xs break-all" style={{ color: BRAND_COLORS.borderDivider }}>{url}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(url); toast.success("Review link copied") }}
        className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50"
        style={{ borderColor: "#E0E3E5", color: BRAND_COLORS.primaryTeal }}
      >
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
    </div>
  )
}

interface SettingKey { key: string; label: string; type: string; hint?: string; options?: string[] }
interface Branch { id: string; name: string }

interface Props {
  globalSettings: Record<string, string>
  globalKeys: SettingKey[]
  branchSettings: Record<string, Record<string, string>>
  branchKeys: SettingKey[]
  branches: Branch[]
}

function SettingRow({ settingKey, value, branchId }: { settingKey: SettingKey; value: string; branchId?: string }) {
  const [val, setVal] = useState(value)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateSettingAction(settingKey.key, val, branchId)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast.error(result.error ?? "Failed to save")
      }
    })
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: BRAND_COLORS.lightBackground }}>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>{settingKey.label}</p>
        {settingKey.hint && <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{settingKey.hint}</p>}
      </div>
      <div className="flex items-center gap-2 ml-4">
        {settingKey.type === "select" ? (
          <select
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="h-9 rounded border border-[#E0E3E5] bg-[#F2F4F6] px-2 text-sm"
          >
            {(settingKey.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <Input
            type={settingKey.type === "number" ? "number" : "text"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className={`h-9 ${settingKey.type === "number" ? "w-36" : "w-64"} border-[#E0E3E5] bg-[#F2F4F6] text-sm`}
          />
        )}
        <button
          onClick={handleSave}
          disabled={isPending || val === value}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND_COLORS.borderDivider }} />
            : saved ? <CheckCircle2 className="h-4 w-4 text-green-500" />
            : <Save className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />}
        </button>
      </div>
    </div>
  )
}

export function SettingsMgmt({ globalSettings, globalKeys, branchSettings, branchKeys, branches }: Props) {
  return (
    <div className="space-y-5">
      {/* Global Settings */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <Globe className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Global Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-0">
          {globalKeys.map((sk) => (
            <SettingRow key={sk.key} settingKey={sk} value={globalSettings[sk.key] ?? ""} />
          ))}
        </CardContent>
      </Card>

      {/* Per-branch Settings */}
      {branches.map((branch) => (
        <Card key={branch.id} className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <Building2 className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              {branch.name} Branch
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-0">
            {branchKeys.map((sk) => (
              <SettingRow
                key={sk.key}
                settingKey={sk}
                value={branchSettings[branch.id]?.[sk.key] ?? ""}
                branchId={branch.id}
              />
            ))}
            <ReviewLinkRow branchId={branch.id} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
