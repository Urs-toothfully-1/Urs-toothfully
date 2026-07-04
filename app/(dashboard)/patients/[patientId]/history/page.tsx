import { Metadata } from "next"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import { DentalHistoryForm } from "@/components/patients/dental-history/DentalHistoryForm"
import { DentalHistoryView } from "@/components/patients/dental-history/DentalHistoryView"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList, History, Lock } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = { title: "Dental History" }

type Props = {
  params: Promise<{ patientId: string }>
  searchParams: Promise<{ v?: string }>
}

export default async function DentalHistoryPage({ params, searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params
  const { v } = await searchParams

  const isDoctor = session.role === "DOCTOR"
  const canEdit = session.role === "ADMIN" || session.role === "RECEPTIONIST"

  const [allVersions, latest] = await Promise.all([
    dentalHistoryRepository.findAllByPatient(patientId),
    dentalHistoryRepository.findLatestByPatient(patientId),
  ])

  // If a specific version is requested, find it
  const requestedVersion = v ? parseInt(v) : null
  const viewingHistory =
    requestedVersion && requestedVersion !== (latest?.version ?? 0)
      ? allVersions.find((h: { version: number; isLatest: boolean }) => h.version === requestedVersion) ?? null
      : null

  // The record we're displaying
  const displayed = viewingHistory ?? latest
  const isViewingHistorical = !!viewingHistory

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main content */}
      <div className="lg:col-span-3">
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                <ClipboardList className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                Dental History
                {latest && (
                  <span
                    className="text-xs px-2 py-0.5 rounded font-normal"
                    style={{
                      backgroundColor: `${BRAND_COLORS.primaryTeal}15`,
                      color: BRAND_COLORS.primaryTeal,
                    }}
                  >
                    v{latest.version}
                  </span>
                )}
              </CardTitle>

              {/* Doctor lock indicator */}
              {isDoctor && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                  <Lock className="h-3 w-3" />
                  Read Only
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {/* CASE 1: No history at all */}
            {!latest && (
              <div className="py-16 text-center space-y-3">
                <ClipboardList className="h-10 w-10 mx-auto" style={{ color: BRAND_COLORS.lightBackground }} />
                {isDoctor ? (
                  <>
                    <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      No dental history recorded
                    </p>
                    <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                      Receptionist or Admin must fill the patient&apos;s dental history form.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                      No dental history yet
                    </p>
                    <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                      Fill in the medical history form below. Patient consent is required.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* CASE 2: Doctor or viewing historical — show read-only */}
            {displayed && (isDoctor || isViewingHistorical) && (
              <DentalHistoryView
                history={displayed}
                createdByName={(displayed as any).createdBy?.name}
              />
            )}

            {/* CASE 3: Admin/Receptionist — show editable form */}
            {canEdit && !isViewingHistorical && (
              <DentalHistoryForm
                patientId={patientId}
                existing={latest}
                isUpdate={!!latest}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Version History sidebar */}
      <div className="lg:col-span-1">
        <Card className="border-[#E0E3E5] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <History className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allVersions.length === 0 ? (
              <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                No history recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {(allVersions as any[]).map((h) => {
                  const isCurrentView =
                    (!requestedVersion && h.isLatest) || requestedVersion === h.version

                  return (
                    <Link
                      key={h.id}
                      href={
                        h.isLatest
                          ? `/patients/${patientId}/history`
                          : `/patients/${patientId}/history?v=${h.version}`
                      }
                      className="block p-2.5 rounded-md border text-sm transition-colors"
                      style={{
                        borderColor: isCurrentView
                          ? BRAND_COLORS.primaryTeal
                          : BRAND_COLORS.lightBackground,
                        backgroundColor: isCurrentView
                          ? `${BRAND_COLORS.primaryTeal}10`
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                          Version {h.version}
                        </span>
                        {h.isLatest && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${BRAND_COLORS.secondaryGreen}20`,
                              color: BRAND_COLORS.secondaryGreen,
                            }}
                          >
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
                        {formatDate(h.createdAt)}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
