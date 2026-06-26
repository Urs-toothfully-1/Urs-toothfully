import { Metadata } from "next"
import Link from "next/link"
import { requireRole } from "@/lib/auth"
import { queueRepository } from "@/server/repositories/queue.repository"
import { QueueEntryCard } from "@/components/queue/QueueEntryCard"
import { BRAND_COLORS } from "@/lib/constants"
import { UserPlus, Search, CreditCard, ClipboardList, RefreshCw, Clock, Stethoscope, DollarSign, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Reception" }
export const dynamic = "force-dynamic"

const QUICK_ACTIONS = [
  { label: "New Patient", icon: UserPlus, href: "/patients/new", color: BRAND_COLORS.primaryTeal },
  { label: "Search Patient", icon: Search, href: "/patients", color: BRAND_COLORS.primaryTeal },
  { label: "Collect Payment", icon: CreditCard, href: "/reception/collect-payment", color: BRAND_COLORS.secondaryGreen },
]

interface SectionProps {
  title: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  entries: any[]
  role: string
  currentUserId: string
  accentColor: string
  emptyText: string
}

function QueueSection({ title, icon: Icon, entries, role, currentUserId, accentColor, emptyText }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
        <h2 className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>{title}</h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
        >
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs py-2 px-3 rounded-md" style={{ color: BRAND_COLORS.borderDivider, backgroundColor: BRAND_COLORS.lightBackground }}>
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <QueueEntryCard
              key={entry.id}
              entry={entry}
              role={role as any}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function ReceptionPage() {
  const session = await requireRole(["RECEPTIONIST", "ADMIN"])

  const today = new Date()
  const allEntries = await queueRepository.findByBranchAndDate(session.branchId, today)

  const waiting = allEntries.filter((e: { status: string }) => e.status === "WAITING")
  const withDoctor = allEntries.filter((e: { status: string }) => e.status === "WITH_DOCTOR")
  const paymentDue = allEntries.filter((e: { status: string }) => e.status === "ESTIMATE_CREATED" || e.status === "PAYMENT_PENDING")
  const completed = allEntries.filter((e: { status: string }) => e.status === "COMPLETED")

  const todayDate = today.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
            Reception
          </h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {todayDate}
          </p>
        </div>
        <form action="/reception">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-[#CCCCCC] hover:bg-white transition-colors"
            style={{ color: BRAND_COLORS.borderDivider }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon
          return (
            <Link key={a.label} href={a.href}>
              <Card className="border-[#CCCCCC] hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="rounded-full p-2" style={{ backgroundColor: `${a.color}1A` }}>
                    <Icon className="h-4 w-4" style={{ color: a.color }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                    {a.label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Waiting", value: waiting.length, color: "#B45309", bg: "#FEF3C7" },
          { label: "With Doctor", value: withDoctor.length, color: "#1D4ED8", bg: "#DBEAFE" },
          { label: "Payment Due", value: paymentDue.length, color: "#C2410C", bg: "#FFEDD5" },
          { label: "Completed", value: completed.length, color: "#065F46", bg: "#D1FAE5" },
        ].map((s) => (
          <Card key={s.label} className="border-[#CCCCCC]">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sectioned Queue */}
      {allEntries.length === 0 ? (
        <Card className="border-[#CCCCCC]">
          <CardContent className="pt-4">
            <div className="text-center py-12">
              <ClipboardList className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                No patients in queue today
              </p>
              <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                Search a patient and use &quot;Add to Queue&quot; to get started.
              </p>
              <Link
                href="/patients"
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium"
                style={{ color: BRAND_COLORS.primaryTeal }}
              >
                <Search className="h-4 w-4" />
                Search Patients
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#CCCCCC]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Today&apos;s Queue
              <span
                className="text-xs px-2 py-0.5 rounded font-normal"
                style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
              >
                {allEntries.length} total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <QueueSection
              title="Waiting for Consultation"
              icon={Clock}
              entries={waiting}
              role={session.role}
              currentUserId={session.userId}
              accentColor="#B45309"
              emptyText="No patients waiting"
            />
            <QueueSection
              title="With Doctor"
              icon={Stethoscope}
              entries={withDoctor}
              role={session.role}
              currentUserId={session.userId}
              accentColor="#1D4ED8"
              emptyText="No patients with doctor"
            />
            <QueueSection
              title="Payment Due"
              icon={DollarSign}
              entries={paymentDue}
              role={session.role}
              currentUserId={session.userId}
              accentColor="#C2410C"
              emptyText="No pending payments"
            />
            <QueueSection
              title="Completed"
              icon={CheckCircle2}
              entries={completed}
              role={session.role}
              currentUserId={session.userId}
              accentColor="#065F46"
              emptyText="No completed visits yet today"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
