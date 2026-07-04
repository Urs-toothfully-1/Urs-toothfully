"use client"

import { useState, useTransition } from "react"
import {
  saveWhatsAppSettingsAction,
  testWhatsAppConnectionAction,
  refreshWhatsAppTokenStatusAction,
} from "@/actions/whatsapp"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { KeyRound, Loader2, PlugZap, RefreshCw, Save, ShieldAlert, Webhook, Copy } from "lucide-react"

interface SettingsShape {
  businessAccountId: string | null
  phoneNumberId: string | null
  accessTokenMask: string | null
  webhookVerifyToken: string | null
  webhookSecretMask: string | null
  graphApiVersion: string
  businessDisplayName: string | null
  defaultCountryCode: string
  apiStatus: string | null
  phoneNumberStatus: string | null
  businessVerificationStatus: string | null
  lastSyncAt: string | null
  sendingEnabled: boolean
  queuePaused: boolean
  messageRateLimit: number
  dailySendingLimit: number
  maxRetryCount: number
}

interface Props {
  settings: SettingsShape | null
  webhookUrl: string
}

const labelCls = "block text-sm font-medium mb-1"
const hintCls = "text-xs mt-1"

export function WhatsAppSettingsForm({ settings, webhookUrl }: Props) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    businessAccountId: settings?.businessAccountId ?? "",
    phoneNumberId: settings?.phoneNumberId ?? "",
    accessToken: "",
    webhookVerifyToken: settings?.webhookVerifyToken ?? "",
    webhookSecret: "",
    graphApiVersion: settings?.graphApiVersion ?? "v21.0",
    businessDisplayName: settings?.businessDisplayName ?? "",
    defaultCountryCode: settings?.defaultCountryCode ?? "91",
    messageRateLimit: settings?.messageRateLimit ?? 20,
    dailySendingLimit: settings?.dailySendingLimit ?? 1000,
    maxRetryCount: settings?.maxRetryCount ?? 3,
  })

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveWhatsAppSettingsAction({
        ...form,
        accessToken: form.accessToken || undefined,
        webhookSecret: form.webhookSecret || undefined,
      })
      if (result.success) {
        toast.success(result.message)
        setForm((prev) => ({ ...prev, accessToken: "", webhookSecret: "" }))
      } else {
        toast.error(result.error ?? "Failed to save")
      }
    })
  }

  function handleTest() {
    startTransition(async () => {
      const result = await testWhatsAppConnectionAction()
      if (result.success) toast.success(result.message)
      else toast.error(result.error ?? "Connection failed")
    })
  }

  function handleTokenCheck() {
    startTransition(async () => {
      const result = await refreshWhatsAppTokenStatusAction()
      if (result.success) toast.success(result.message)
      else toast.error(result.error ?? "Token check failed")
    })
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl).then(
      () => toast.success("Webhook URL copied"),
      () => toast.error("Could not copy")
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Credentials */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <KeyRound className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Meta API Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-xs">
            <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Credentials are encrypted at rest and visible only to administrators.
              Tokens are never shown again after saving — only a masked preview.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Business Account ID (WABA) <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.businessAccountId}
                onChange={(e) => set("businessAccountId", e.target.value)}
                placeholder="e.g. 123456789012345"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Phone Number ID <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.phoneNumberId}
                onChange={(e) => set("phoneNumberId", e.target.value)}
                placeholder="e.g. 109876543210987"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>
                Access Token <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                value={form.accessToken}
                onChange={(e) => set("accessToken", e.target.value)}
                placeholder={settings?.accessTokenMask ? `Saved: ${settings.accessTokenMask} — enter a new token to replace` : "Permanent System User token"}
                autoComplete="new-password"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
              <p className={hintCls} style={{ color: BRAND_COLORS.sidebarMuted }}>
                Use a permanent System User token from Meta Business Manager. Leave blank to keep the saved token.
              </p>
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Graph API Version</label>
              <Input
                value={form.graphApiVersion}
                onChange={(e) => set("graphApiVersion", e.target.value)}
                placeholder="v21.0"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Business Display Name</label>
              <Input
                value={form.businessDisplayName}
                onChange={(e) => set("businessDisplayName", e.target.value)}
                placeholder="Ur's Toothfully"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Default Country Code</label>
              <Input
                value={form.defaultCountryCode}
                onChange={(e) => set("defaultCountryCode", e.target.value)}
                placeholder="91"
                maxLength={5}
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
              <p className={hintCls} style={{ color: BRAND_COLORS.sidebarMuted }}>
                Prefixed to 10-digit local numbers (91 = India).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <Webhook className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Webhook URL (read-only)</label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="border-[#E0E3E5] bg-[#F2F4F6] font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyWebhookUrl} className="h-9 px-3" aria-label="Copy webhook URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className={hintCls} style={{ color: BRAND_COLORS.sidebarMuted }}>
              Paste this as the Callback URL in Meta App Dashboard → WhatsApp → Configuration.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Webhook Verify Token</label>
              <Input
                value={form.webhookVerifyToken}
                onChange={(e) => set("webhookVerifyToken", e.target.value)}
                placeholder="A random string you also enter in Meta"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Webhook Secret (App Secret)</label>
              <Input
                type="password"
                value={form.webhookSecret}
                onChange={(e) => set("webhookSecret", e.target.value)}
                placeholder={settings?.webhookSecretMask ? `Saved: ${settings.webhookSecretMask} — enter to replace` : "Meta app secret for signature validation"}
                autoComplete="new-password"
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sending limits */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <PlugZap className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Sending Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Message Rate Limit (per min)</label>
              <Input
                type="number"
                min={1}
                max={600}
                value={form.messageRateLimit}
                onChange={(e) => set("messageRateLimit", Number(e.target.value))}
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Daily Sending Limit</label>
              <Input
                type="number"
                min={1}
                max={100000}
                value={form.dailySendingLimit}
                onChange={(e) => set("dailySendingLimit", Number(e.target.value))}
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: BRAND_COLORS.bodyText }}>Maximum Retry Count</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.maxRetryCount}
                onChange={(e) => set("maxRetryCount", Number(e.target.value))}
                className="border-[#E0E3E5] bg-[#F2F4F6]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="h-11 px-6 font-semibold text-white"
          style={{ backgroundColor: isPending ? BRAND_COLORS.borderDivider : BRAND_COLORS.primaryTeal }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
        <Button onClick={handleTest} disabled={isPending} variant="outline" className="h-11 px-5 font-semibold">
          <PlugZap className="h-4 w-4 mr-2" />
          Test Connection
        </Button>
        <Button onClick={handleTokenCheck} disabled={isPending} variant="outline" className="h-11 px-5 font-semibold">
          <RefreshCw className="h-4 w-4 mr-2" />
          Verify Access Token
        </Button>
      </div>

      {settings?.lastSyncAt && (
        <p className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
          Last successful sync: {new Date(settings.lastSyncAt).toLocaleString("en-IN")}
          {settings.apiStatus ? ` · API: ${settings.apiStatus}` : ""}
        </p>
      )}
    </div>
  )
}
