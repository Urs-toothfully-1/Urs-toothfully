import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { queueRepository } from "@/server/repositories/queue.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { QueueEntryCard } from "@/components/queue/QueueEntryCard"
import { BRAND_COLORS } from "@/lib/constants"
import { Stethoscope, RefreshCw, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = { title: "Doctor Queue" }
export const dynamic = "force-dynamic"

export default async function DoctorPage() {
  const session = await requireRole(["DOCTOR", "ADMIN"])

  const today = new Date()
  const assignmentMode = await settingsRepository.get("queue_assignment_mode", session.branchId)
  const isNextAvailable = assignmentMode === "NEXT_AVAILABLE_DOCTOR"

  const [myQueue, unclaimedQueue] = await Promise.all([
    queueRepository.findByDoctorAndDate(session.userId, today),
    isNextAvailable
      ? queueRepository.findWaitingForNextAvailable(session.branchId)
      : Promise.resolve([]),
  ])

  const active = myQueue.filter((e: { status: string }) =>
    ["WAITING", "WITH_DOCTOR", "ESTIMATE_CREATED"].includes(e.status)
  )
  const completed = myQueue.filter((e: { status: string }) => ["COMPLETED", "CANCELLED"].includes(e.status))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
            My Patients
          </h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {session.name} ·{" "}
            {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <form action="/doctor">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: active.length, color: BRAND_COLORS.primaryTeal },
          { label: "Seen Today", value: completed.length, color: BRAND_COLORS.secondaryGreen },
          { label: "Total Today", value: myQueue.length, color: BRAND_COLORS.borderDivider },
        ].map((s) => (
          <Card key={s.label} className="border-[#CCCCCC]">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unclaimed patients (NEXT_AVAILABLE mode) */}
      {isNextAvailable && unclaimedQueue.length > 0 && (
        <Card className="border-[#4ABCC8]">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.primaryTeal }}>
              <Users className="h-4 w-4" />
              Waiting — Claim a Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {(unclaimedQueue as any[]).map((entry) => (
              <QueueEntryCard
                key={entry.id}
                entry={entry}
                role={session.role}
                currentUserId={session.userId}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* My Queue */}
      <Card className="border-[#CCCCCC]">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <Stethoscope className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            My Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {myQueue.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                No patients today
              </p>
              <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                Patients added to the queue by reception will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(myQueue as any[]).map((entry) => (
                <QueueEntryCard
                  key={entry.id}
                  entry={entry as any}
                  role={session.role}
                  currentUserId={session.userId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
