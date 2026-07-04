import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav"
import { AdminControls } from "@/components/whatsapp/AdminControls"
import {
  MessageCircle, CheckCircle2, XCircle, Clock, TrendingUp,
  Megaphone, Wrench, Timer, Wifi, WifiOff, BadgeCheck, ListOrdered,
} from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "WhatsApp — Overview" }
export const dynamic = "force-dynamic"

function formatDeliveryTime(seconds: number | null): string {
  if (seconds === null) return "—"
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`
}

export default async function WhatsAppOverviewPage() {
  const session = await requireRole(["ADMIN", "RECEPTIONIST"])
  const overview = await whatsappService.getOverview()

  const isAdmin = session.role === "ADMIN"
  const apiOk = overview.apiStatus === "CONNECTED"

  const KPI_CARDS = [
    { label: "Messages Today", value: overview.today.total.toString(), icon: MessageCircle, color: BRAND_COLORS.primaryTeal },
    { label: "Utility Today", value: overview.today.utility.toString(), icon: Wrench, color: BRAND_COLORS.primaryTeal },
    { label: "Marketing Today", value: overview.today.marketing.toString(), icon: Megaphone, color: "#7C3AED" },
    { label: "Failed Today", value: overview.today.failed.toString(), icon: XCircle, color: overview.today.failed > 0 ? "#DC2626" : BRAND_COLORS.secondaryGreen },
    { label: "Pending in Queue", value: overview.today.pending.toString(), icon: Clock, color: overview.today.pending > 0 ? "#F59E0B" : BRAND_COLORS.secondaryGreen },
    { label: "Delivery Success", value: overview.today.successPct === null ? "—" : `${overview.today.successPct}%`, icon: CheckCircle2, color: BRAND_COLORS.secondaryGreen },
    { label: "This Week", value: overview.week.total.toString(), icon: TrendingUp, color: BRAND_COLORS.primaryTeal },
    { label: "Avg Delivery Time", value: formatDeliveryTime(overview.avgDeliverySeconds), icon: Timer, color: BRAND_COLORS.primaryTeal },
  ]

  const STATUS_ROWS = [
    {
      label: "Meta API Status",
      value: overview.configured ? (apiOk ? "Connected" : overview.apiStatus) : "Not configured",
      ok: apiOk,
      icon: apiOk ? Wifi : WifiOff,
    },
    {
      label: "Phone Number Status",
      value: overview.phoneNumberStatus ?? "—",
      ok: Boolean(overview.phoneNumberStatus),
      icon: MessageCircle,
    },
    {
      label: "Business Verification",
      value: overview.businessVerificationStatus ?? "—",
      ok: overview.businessVerificationStatus === "APPROVED",
      icon: BadgeCheck,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          WhatsApp Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Meta WhatsApp Cloud API · patient notifications, receipts &amp; reminders
        </p>
      </div>

      <WhatsAppNav role={session.role} />

      {/* Connection status strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STATUS_ROWS.map((row) => {
          const Icon = row.icon
          return (
            <Card key={row.label} className="border-[#E0E3E5] bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className="rounded-full p-2 flex-shrink-0"
                  style={{ backgroundColor: row.ok ? "#D1FAE5" : "#FEF3C7" }}
                >
                  <Icon className="h-4 w-4" style={{ color: row.ok ? "#065F46" : "#92400E" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>{row.label}</p>
                  <p className="text-sm font-semibold truncate" style={{ color: BRAND_COLORS.bodyText }}>{row.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!overview.configured && isAdmin && (
        <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
          WhatsApp is not configured yet.{" "}
          <Link href="/whatsapp/settings" className="font-semibold underline">
            Open API Settings
          </Link>{" "}
          to connect your Meta Business account.
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-[#E0E3E5] bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium" style={{ color: BRAND_COLORS.borderDivider }}>
                  {kpi.label}
                </CardTitle>
                <div className="rounded-full p-1.5" style={{ backgroundColor: `${kpi.color}1A` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
                </div>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>{kpi.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Admin controls */}
      {isAdmin && (
        <AdminControls
          sendingEnabled={overview.sendingEnabled}
          queuePaused={overview.queuePaused}
          messageRateLimit={overview.messageRateLimit}
          dailySendingLimit={overview.dailySendingLimit}
          queueSize={overview.queueSize}
        />
      )}

      {/* Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <TrendingUp className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Most Used Templates (this month)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-2">
            {overview.topTemplates.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: BRAND_COLORS.sidebarMuted }}>
                No messages sent yet this month.
              </p>
            ) : (
              overview.topTemplates.map((t) => (
                <div key={t.templateName} className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}>
                  <span style={{ color: BRAND_COLORS.secondaryText }}>{t.templateName}</span>
                  <span className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{t.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <XCircle className="h-4 w-4 text-red-500" />
              Top Failed Templates (this month)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-2">
            {overview.topFailedTemplates.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: BRAND_COLORS.sidebarMuted }}>
                No failures this month.
              </p>
            ) : (
              overview.topFailedTemplates.map((t) => (
                <div key={t.templateName} className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}>
                  <span style={{ color: BRAND_COLORS.secondaryText }}>{t.templateName}</span>
                  <span className="font-semibold text-red-600">{t.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <ListOrdered className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Messages by Branch (this month)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-2">
            {overview.byBranch.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: BRAND_COLORS.sidebarMuted }}>No data yet.</p>
            ) : (
              overview.byBranch.map((b, i) => (
                <div key={`${b.name}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}>
                  <span style={{ color: BRAND_COLORS.secondaryText }}>{b.name}</span>
                  <span className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{b.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <ListOrdered className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Messages by Staff (this month)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-2">
            {overview.byUser.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: BRAND_COLORS.sidebarMuted }}>No data yet.</p>
            ) : (
              overview.byUser.map((u, i) => (
                <div key={`${u.name}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}>
                  <span style={{ color: BRAND_COLORS.secondaryText }}>{u.name}</span>
                  <span className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{u.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer meta */}
      <p className="text-xs" style={{ color: BRAND_COLORS.sidebarMuted }}>
        Monthly success rate: {overview.month.successPct === null ? "—" : `${overview.month.successPct}%`} ·
        Messages this month: {overview.month.total} ·
        Last sync: {overview.lastSyncAt ? new Date(overview.lastSyncAt).toLocaleString("en-IN") : "never"}
      </p>
    </div>
  )
}
