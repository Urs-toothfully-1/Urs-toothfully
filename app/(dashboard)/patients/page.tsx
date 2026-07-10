import { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { patientRepository, SEARCH_PAGE_SIZE } from "@/server/repositories/patient.repository"
import { PatientSearchInput } from "@/components/patients/PatientSearchInput"
import { BRAND_COLORS } from "@/lib/constants"
import { calculateAge, formatDate } from "@/lib/utils"
import { UserPlus, Users, Clock, Stethoscope, Activity, CheckCircle2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Patients" }
export const dynamic = "force-dynamic"

const GENDER_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" }

type PatientRow = Awaited<ReturnType<typeof patientRepository.findAllWithTreatmentStatus>>[0]
type StageKey = "pre-consultation" | "awaiting-treatment" | "ongoing" | "completed"

function categorize(p: PatientRow): StageKey {
  const hasConsultation = p.payments.length > 0
  const hasOngoing = p.estimates.some((e: { status: string }) => e.status === "ACTIVE" || e.status === "DRAFT")
  const hasCompleted = p.estimates.some((e: { status: string }) => e.status === "COMPLETED")

  if (!hasConsultation) return "pre-consultation"
  if (hasOngoing) return "ongoing"
  if (hasCompleted) return "completed"
  return "awaiting-treatment"
}

interface SectionConfig {
  key: StageKey
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  accentColor: string
  badgeLabel: string
  emptyText: string
}

const SECTIONS: SectionConfig[] = [
  {
    key: "pre-consultation",
    title: "Waiting to Pay Consultation",
    subtitle: "Registered patients who have not yet paid the consultation fee",
    icon: Clock,
    accentColor: "#B45309",
    badgeLabel: "Pre-Consultation",
    emptyText: "No patients waiting for consultation payment",
  },
  {
    key: "awaiting-treatment",
    title: "Paid Consultation — Awaiting Treatment",
    subtitle: "Consultation fee paid; estimate or treatment plan not yet started",
    icon: Stethoscope,
    accentColor: "#1D4ED8",
    badgeLabel: "Awaiting Treatment",
    emptyText: "No patients in this stage",
  },
  {
    key: "ongoing",
    title: "Ongoing Treatment",
    subtitle: "Active treatment plan in progress",
    icon: Activity,
    accentColor: "#C2410C",
    badgeLabel: "Ongoing",
    emptyText: "No patients currently under treatment",
  },
  {
    key: "completed",
    title: "Treatment Completed",
    subtitle: "All treatment plans completed",
    icon: CheckCircle2,
    accentColor: "#065F46",
    badgeLabel: "Completed",
    emptyText: "No completed treatments yet",
  },
]

function PatientCard({ p, badgeLabel, badgeBg, badgeColor }: {
  p: PatientRow | any
  badgeLabel?: string
  badgeBg?: string
  badgeColor?: string
}) {
  const age = calculateAge(new Date(p.dateOfBirth))
  return (
    <Link href={`/patients/${p.id}`}>
      <Card className="border-[#E0E3E5] hover:shadow-md hover:border-[#0077BE] transition-all cursor-pointer">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
            >
              {p.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: BRAND_COLORS.bodyText }}>
                  {p.fullName}
                </span>
                <Badge
                  className="text-xs px-1.5 py-0 font-mono"
                  style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}1A`, color: BRAND_COLORS.primaryTeal, border: "none" }}
                >
                  {p.patientId}
                </Badge>
                {badgeLabel && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: badgeBg, color: badgeColor }}
                  >
                    {badgeLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                  {GENDER_SHORT[p.gender]} · {age}y
                </span>
                <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                  📱 {p.mobile}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
              {p.registrationBranch.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
              {formatDate(p.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// ── Stage filter cards ────────────────────────────────────────────────────────

function StageFilterCards({
  counts,
  activeStage,
  scopeAll,
}: {
  counts: Record<StageKey, number>
  activeStage: StageKey | null
  scopeAll: boolean
}) {
  const scopeQs = scopeAll ? "scope=all" : ""
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SECTIONS.map((s) => {
        const Icon = s.icon
        const isActive = activeStage === s.key
        const href = isActive
          ? `/patients${scopeQs ? `?${scopeQs}` : ""}`
          : `/patients?stage=${s.key}${scopeQs ? `&${scopeQs}` : ""}`

        return (
          <Link key={s.key} href={href}>
            <Card
              className="border-2 transition-all cursor-pointer hover:shadow-md"
              style={{
                borderColor: isActive ? s.accentColor : "#E0E3E5",
                backgroundColor: isActive ? `${s.accentColor}10` : "white",
              }}
            >
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Icon className="h-5 w-5" style={{ color: s.accentColor }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: s.accentColor }}>
                  {counts[s.key]}
                </p>
                <p className="text-xs mt-1 leading-tight font-medium" style={{ color: isActive ? s.accentColor : BRAND_COLORS.bodyText }}>
                  {s.title}
                </p>
                {isActive && (
                  <p className="text-xs mt-1" style={{ color: s.accentColor }}>
                    Click to clear ×
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

// ── Main list logic ───────────────────────────────────────────────────────────

async function PatientListView({ stage, branchId, scopeAll }: { stage: StageKey | null; branchId?: string; scopeAll: boolean }) {
  const allPatients = await patientRepository.findAllWithTreatmentStatus(branchId)
  const scopeQs = scopeAll ? "scope=all" : ""

  const buckets: Record<StageKey, PatientRow[]> = {
    "pre-consultation": [],
    "awaiting-treatment": [],
    ongoing: [],
    completed: [],
  }
  for (const p of allPatients) {
    buckets[categorize(p)].push(p)
  }

  const counts: Record<StageKey, number> = {
    "pre-consultation": buckets["pre-consultation"].length,
    "awaiting-treatment": buckets["awaiting-treatment"].length,
    ongoing: buckets["ongoing"].length,
    completed: buckets["completed"].length,
  }

  const totalPatients = allPatients.length

  if (totalPatients === 0) {
    return (
      <>
        <StageFilterCards counts={counts} activeStage={stage} scopeAll={scopeAll} />
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
          <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>No patients registered yet.</p>
          <Link href="/patients/new" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium" style={{ color: BRAND_COLORS.primaryTeal }}>
            <UserPlus className="h-4 w-4" /> Register first patient
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <StageFilterCards counts={counts} activeStage={stage} scopeAll={scopeAll} />

      {/* Active filter: show only that stage */}
      {stage ? (() => {
        const section = SECTIONS.find((s) => s.key === stage)!
        const Icon = section.icon
        const patients = buckets[stage]
        return (
          <Card className="border-[#E0E3E5]">
            <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                  <Icon className="h-4 w-4" style={{ color: section.accentColor }} />
                  {section.title}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-normal"
                    style={{ backgroundColor: `${section.accentColor}18`, color: section.accentColor }}
                  >
                    {patients.length}
                  </span>
                </CardTitle>
                <Link
                  href={`/patients${scopeQs ? `?${scopeQs}` : ""}`}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#E0E3E5] hover:bg-gray-50"
                  style={{ color: BRAND_COLORS.borderDivider }}
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </Link>
              </div>
              <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
                {section.subtitle}
              </p>
            </CardHeader>
            <CardContent className="pt-3">
              {patients.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: BRAND_COLORS.borderDivider }}>
                  {section.emptyText}
                </p>
              ) : (
                <div className="space-y-2">
                  {patients.map((p) => (
                    <PatientCard
                      key={p.id}
                      p={p}
                      badgeLabel={section.badgeLabel}
                      badgeBg={`${section.accentColor}18`}
                      badgeColor={section.accentColor}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })() : (
        /* No filter: show all 4 sections */
        <div className="space-y-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const patients = buckets[s.key]
            return (
              <Card key={s.key} className="border-[#E0E3E5]">
                <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                  <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
                    <Icon className="h-4 w-4" style={{ color: s.accentColor }} />
                    {s.title}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-normal"
                      style={{ backgroundColor: `${s.accentColor}18`, color: s.accentColor }}
                    >
                      {patients.length}
                    </span>
                    <Link
                      href={`/patients?stage=${s.key}${scopeQs ? `&${scopeQs}` : ""}`}
                      className="ml-auto text-xs font-normal hover:underline"
                      style={{ color: BRAND_COLORS.primaryTeal }}
                    >
                      View only →
                    </Link>
                  </CardTitle>
                  <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{s.subtitle}</p>
                </CardHeader>
                <CardContent className="pt-3">
                  {patients.length === 0 ? (
                    <p className="text-xs py-2" style={{ color: BRAND_COLORS.borderDivider }}>
                      {s.emptyText}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {patients.map((p) => (
                        <PatientCard
                          key={p.id}
                          p={p}
                          badgeLabel={s.badgeLabel}
                          badgeBg={`${s.accentColor}18`}
                          badgeColor={s.accentColor}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

async function SearchResults({ query, page, branchId, scopeAll }: { query: string; page: number; branchId?: string; scopeAll: boolean }) {
  const [patients, total] = await Promise.all([
    patientRepository.search(query, page, branchId),
    patientRepository.searchCount(query, branchId),
  ])
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE))
  const from = (page - 1) * SEARCH_PAGE_SIZE + 1
  const to = Math.min(page * SEARCH_PAGE_SIZE, total)
  const pageHref = (p: number) => `/patients?q=${encodeURIComponent(query)}&page=${p}${scopeAll ? "&scope=all" : ""}`

  if (patients.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>
          No patients found for &quot;{query}&quot;
        </p>
        <p className="text-sm mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
          Check the spelling or try a different term
        </p>
        <Link
          href="/patients/new"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium"
          style={{ color: BRAND_COLORS.primaryTeal }}
        >
          <UserPlus className="h-4 w-4" />
          Register as new patient
        </Link>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs pb-1" style={{ color: BRAND_COLORS.borderDivider }}>
        {total > SEARCH_PAGE_SIZE
          ? `Showing ${from}–${to} of ${total} results for "${query}"`
          : `${total} result${total !== 1 ? "s" : ""} for "${query}"`}
      </p>
      {patients.map((p) => <PatientCard key={p.id} p={p} />)}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#E0E3E5] bg-white hover:bg-gray-50"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              ← Previous
            </Link>
          ) : <span />}
          <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#E0E3E5] bg-white hover:bg-gray-50"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              Next →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ q?: string; stage?: string; page?: string; scope?: string }>
}

const VALID_STAGES = new Set<StageKey>(["pre-consultation", "awaiting-treatment", "ongoing", "completed"])

export default async function PatientsPage({ searchParams }: Props) {
  const session = await requireSession()
  const { q = "", stage: rawStage, page: rawPage, scope } = await searchParams

  const isSearching = q.trim().length >= 2
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1)
  const activeStage: StageKey | null =
    rawStage && VALID_STAGES.has(rawStage as StageKey) ? (rawStage as StageKey) : null

  // Receptionists see only their branch's patients by default; the "All Patients"
  // toggle removes the branch filter. Admins/doctors always see everyone.
  const isReception = session.role === "RECEPTIONIST"
  const scopeAll = !isReception || scope === "all"
  const branchFilter = isReception && !scopeAll ? session.branchId : undefined

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>Patients</h1>
          <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
            {isSearching
              ? "Search results"
              : activeStage
              ? `Filtered: ${SECTIONS.find((s) => s.key === activeStage)?.title}`
              : isReception
              ? (scopeAll ? "Showing patients from all branches" : "Showing your branch's patients")
              : "Filter by treatment stage or search below"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReception && (
            scopeAll ? (
              <Link
                href="/patients"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border"
                style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
              >
                <Users className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                My Branch Only
              </Link>
            ) : (
              <Link
                href="/patients?scope=all"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border"
                style={{ borderColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
              >
                <Users className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                All Patients
              </Link>
            )
          )}
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white"
            style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
          >
            <UserPlus className="h-4 w-4" />
            New Patient
          </Link>
        </div>
      </div>

      {/* Search Input */}
      <Suspense fallback={null}>
        <PatientSearchInput defaultValue={q} placeholder="Search by name, mobile, ID, email…" />
      </Suspense>

      {/* Content */}
      <Suspense
        fallback={
          <div className="text-center py-10 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
            Loading…
          </div>
        }
      >
        {isSearching
          ? <SearchResults query={q} page={page} branchId={branchFilter} scopeAll={scopeAll} />
          : <PatientListView stage={activeStage} branchId={branchFilter} scopeAll={scopeAll} />
        }
      </Suspense>
    </div>
  )
}
