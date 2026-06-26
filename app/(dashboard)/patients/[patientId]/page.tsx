import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { patientRepository } from "@/server/repositories/patient.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { userRepository } from "@/server/repositories/user.repository"
import { settingsRepository } from "@/server/repositories/settings.repository"
import { AddToQueueDialog } from "@/components/queue/AddToQueueDialog"
import { queueRepository } from "@/server/repositories/queue.repository"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Phone, Mail, Calendar, Tag, User } from "lucide-react"

type Props = { params: Promise<{ patientId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { patientId } = await params
  const patient = await patientRepository.findById(patientId)
  return { title: patient ? `${patient.fullName} — Overview` : "Patient" }
}

export default async function PatientOverviewPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { patientId } = await params

  const [patient, visits] = await Promise.all([
    patientRepository.findById(patientId),
    visitRepository.findByPatient(patientId),
  ])

  if (!patient) notFound()

  // Fetch Add to Queue data only for reception/admin
  const canAddToQueue = session.role === "RECEPTIONIST" || session.role === "ADMIN"
  const [doctors, assignmentMode, activeQueueEntry] = canAddToQueue
    ? await Promise.all([
        userRepository.findAllActiveDoctors(),
        settingsRepository.get("queue_assignment_mode", session.branchId),
        queueRepository.findActiveForPatientToday(patientId, session.branchId),
      ])
    : [[], null, null]

  const recentVisits = visits.slice(0, 5)

  const detailRows = [
    { icon: Phone, label: "Mobile", value: patient.mobile },
    { icon: Mail, label: "Email", value: patient.email ?? "—" },
    { icon: MapPin, label: "Address", value: patient.address ?? "—" },
    { icon: Tag, label: "Lead Source", value: patient.leadSource ?? "—" },
    { icon: User, label: "Reference", value: patient.referenceName ?? "—" },
    {
      icon: Calendar,
      label: "Registered",
      value: `${patient.registrationBranch.name} Branch · ${formatDate(patient.createdAt)}`,
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Patient Details */}
      <Card className="lg:col-span-1 border-[#CCCCCC] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
            Patient Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detailRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3">
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_COLORS.borderDivider }} />
              <div>
                <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{label}</p>
                <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{value}</p>
              </div>
            </div>
          ))}
          {patient.reasonForVisit && (
            <div className="pt-2 border-t" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <p className="text-xs mb-1" style={{ color: BRAND_COLORS.borderDivider }}>Chief Complaint</p>
              <p className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>{patient.reasonForVisit}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right column */}
      <div className="lg:col-span-2 space-y-4">
        {/* Add to Queue CTA */}
        {canAddToQueue && (
          <Card className={activeQueueEntry ? "border-amber-400 bg-amber-50" : "border-[#4ABCC8] bg-[#4ABCC8]/5"}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              {activeQueueEntry ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-amber-700">
                      Already in today&apos;s queue
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                      Token #{activeQueueEntry.tokenNumber} · Status: {activeQueueEntry.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Link
                    href="/reception"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border border-amber-400 text-amber-700 bg-white"
                  >
                    View Queue
                  </Link>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                      Ready to see a doctor?
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                      Add {patient.fullName} to today&apos;s queue
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AddToQueueDialog
                      patientId={patient.id}
                      patientName={patient.fullName}
                      branchName={patient.registrationBranch.name}
                      doctors={doctors as any}
                      assignmentMode={assignmentMode ?? "SPECIFIC_DOCTOR"}
                    />
                    <Link
                      href={`/reception/collect-payment?patientId=${patient.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border border-[#CCCCCC]"
                      style={{ color: BRAND_COLORS.bodyText }}
                    >
                      Collect Payment
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Next Steps for new patients */}
        {visits.length === 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-amber-800">Next Steps for New Patient</p>
              <ol className="mt-2 space-y-1 text-sm list-decimal list-inside text-amber-700">
                <li>
                  <Link href={`/patients/${patientId}/history`} className="underline">
                    Fill Dental History
                  </Link>
                </li>
                <li>Collect Consultation Fee</li>
                <li>Add to Doctor Queue (button above)</li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Visit summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Visits", value: visits.length.toString() },
            { label: "Branches", value: new Set(visits.map((v: any) => v.branchId)).size.toString() },
            { label: "Last Visit", value: visits[0] ? formatDate(visits[0].visitDate) : "—" },
          ].map((s) => (
            <Card key={s.label} className="border-[#CCCCCC] bg-white">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Visits */}
        <Card className="border-[#CCCCCC] bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                Recent Visits
              </CardTitle>
              {visits.length > 5 && (
                <Link href={`/patients/${patientId}/visits`} className="text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                  View all →
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: BRAND_COLORS.borderDivider }}>
                No visits yet
              </p>
            ) : (
              <div className="space-y-2">
                {recentVisits.map((visit: any) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: BRAND_COLORS.lightBackground }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: BRAND_COLORS.bodyText }}>{visit.visitNo}</p>
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                        {visit.visitType?.replace(/_/g, " ")} · {visit.branch?.name ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>{formatDate(visit.visitDate)}</p>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: visit.status === "COMPLETED" ? "#DCFCE7" : visit.status === "IN_PROGRESS" ? "#FEF9C3" : "#F3F4F6",
                          color: visit.status === "COMPLETED" ? "#166534" : visit.status === "IN_PROGRESS" ? "#854D0E" : BRAND_COLORS.borderDivider,
                        }}
                      >
                        {visit.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
