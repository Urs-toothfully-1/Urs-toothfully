import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { patientRepository } from "@/server/repositories/patient.repository"
import { dentalHistoryRepository } from "@/server/repositories/dental-history.repository"
import { HealthAlertBadges } from "@/components/patients/HealthAlertBadges"
import { ProfileTabs } from "@/components/patients/ProfileTabs"
import { BRAND_COLORS } from "@/lib/constants"
import { calculateAge, formatDate } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

type Props = {
  children: React.ReactNode
  params: Promise<{ patientId: string }>
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
}

export default async function PatientProfileLayout({ children, params }: Props) {
  await requireSession()
  const { patientId } = await params

  const [patient, dentalHistory] = await Promise.all([
    patientRepository.findById(patientId),
    dentalHistoryRepository.findLatestByPatient(patientId),
  ])

  if (!patient) notFound()

  const age = calculateAge(new Date(patient.dateOfBirth))

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 text-sm mb-4"
        style={{ color: BRAND_COLORS.borderDivider }}
      >
        <Link href="/patients" className="hover:underline" style={{ color: BRAND_COLORS.primaryTeal }}>
          Patients
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{patient.fullName}</span>
      </nav>

      {/* Profile Header Card */}
      <div className="bg-white rounded-xl border border-[#CCCCCC] overflow-hidden shadow-sm">
        {/* Top teal bar */}
        <div className="h-1.5" style={{ backgroundColor: BRAND_COLORS.primaryTeal }} />

        <div className="px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left — name + ID + demographics */}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
              >
                {patient.fullName.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
                    {patient.fullName}
                  </h1>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${BRAND_COLORS.primaryTeal}1A`,
                      color: BRAND_COLORS.primaryTeal,
                    }}
                  >
                    {patient.patientId}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                    {GENDER_LABELS[patient.gender]} · {age} yrs
                  </span>
                  <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                    DOB: {formatDate(patient.dateOfBirth)}
                  </span>
                  <span className="text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                    📱 {patient.mobile}
                  </span>
                  {patient.email && (
                    <span className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                      ✉ {patient.email}
                    </span>
                  )}
                </div>

                <div className="mt-1.5">
                  <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                    Registered: {patient.registrationBranch.name} Branch · {formatDate(patient.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right — health alerts */}
            <div className="md:text-right">
              <HealthAlertBadges history={dentalHistory as any} />
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <ProfileTabs patientId={patientId} />
      </div>

      {/* Tab content */}
      <div className="mt-4">{children}</div>
    </div>
  )
}
