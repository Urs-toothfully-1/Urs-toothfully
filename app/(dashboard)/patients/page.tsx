import { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import {
  patientRepository,
  patientListRepository,
  SEARCH_PAGE_SIZE,
  PATIENT_PAGE_SIZE,
  PATIENT_STAGES,
} from "@/server/repositories/patient.repository"
import { PatientSearchInput } from "@/components/patients/PatientSearchInput"
import { PatientDateFilter } from "@/components/patients/PatientDateFilter"
import { BranchBadge } from "@/components/shared/BranchBadge"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { formatAge } from "@/lib/patient-dob"
import { UserPlus, Users, Clock, Stethoscope, Activity, CheckCircle2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Patients" }
export const dynamic = "force-dynamic"

const GENDER_SHORT: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" }

type PatientRow = Awaited<ReturnType<typeof patientListRepository.findPage>>[0]
type StageKey = "pre-consultation" | "awaiting-treatment" | "ongoing" | "completed"

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
  const age = formatAge(p.dateOfBirth)
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
                  {GENDER_SHORT[p.gender]} · {age === "—" ? "age —" : `${age}y`}
                </span>
                <span className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                  📱 {p.mobile}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <BranchBadge name={p.registrationBranch.name} />
            <p className="text-xs mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
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
  params,
}: {
  counts: Record<StageKey, number>
  activeStage: StageKey | null
  params: PatientListParams
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SECTIONS.map((s) => {
        const Icon = s.icon
        const isActive = activeStage === s.key
        // Clicking the active card clears the stage; page always resets to 1.
        const href = pageHref(params, { stage: isActive ? null : s.key, page: 1 })

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

function pageHref(base: PatientListParams, overrides: Partial<PatientListParams> = {}) {
  const merged = { ...base, ...overrides }
  const qs = new URLSearchParams()
  if (merged.stage) qs.set("stage", merged.stage)
  if (merged.scopeAll) qs.set("scope", "all")
  if (merged.from) qs.set("from", merged.from)
  if (merged.to) qs.set("to", merged.to)
  if (merged.page && merged.page > 1) qs.set("page", String(merged.page))
  const query = qs.toString()
  return `/patients${query ? `?${query}` : ""}`
}

interface PatientListParams {
  stage: StageKey | null
  scopeAll: boolean
  from?: string
  to?: string
  page: number
}

async function PatientListView({
  params,
  branchId,
}: {
  params: PatientListParams
  branchId?: string
}) {
  const { stage, page } = params
  // Dates arrive as YYYY-MM-DD; widen `to` to the end of that day so a
  // single-day range includes everyone registered during it.
  const from = params.from ? new Date(`${params.from}T00:00:00`) : undefined
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : undefined
  const filters = { branchId, from, to }

  // Two indexed queries, both bounded: the counts behind the stage cards and a
  // single page of rows. Nothing else is read, so the page size no longer grows
  // with the size of the patient list.
  const [counts, patients] = await Promise.all([
    patientListRepository.countByStage(filters),
    patientListRepository.findPage(filters, stage, page),
  ])

  const total = stage
    ? counts[stage]
    : PATIENT_STAGES.reduce((sum, key) => sum + counts[key], 0)
  const totalPages = Math.max(1, Math.ceil(total / PATIENT_PAGE_SIZE))
  const first = total === 0 ? 0 : (page - 1) * PATIENT_PAGE_SIZE + 1
  const last = Math.min(page * PATIENT_PAGE_SIZE, total)
  const section = stage ? SECTIONS.find((s) => s.key === stage)! : null

  return (
    <>
      <StageFilterCards counts={counts} activeStage={stage} params={params} />

      <Card className="border-[#E0E3E5]">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              {section ? (
                <>
                  <section.icon className="h-4 w-4" style={{ color: section.accentColor }} />
                  {section.title}
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
                  All Patients
                </>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full font-normal"
                style={{
                  backgroundColor: `${section?.accentColor ?? BRAND_COLORS.primaryTeal}18`,
                  color: section?.accentColor ?? BRAND_COLORS.primaryTeal,
                }}
              >
                {total}
              </span>
            </CardTitle>
            {stage && (
              <Link
                href={pageHref(params, { stage: null, page: 1 })}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#E0E3E5] hover:bg-gray-50"
                style={{ color: BRAND_COLORS.borderDivider }}
              >
                <X className="h-3 w-3" />
                Clear filter
              </Link>
            )}
          </div>
          {section && (
            <p className="text-xs mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>{section.subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="pt-3">
          {patients.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-10 w-10 mx-auto mb-3" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                {section ? section.emptyText : "No patients match these filters."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs pb-2" style={{ color: BRAND_COLORS.borderDivider }}>
                Showing {first}–{last} of {total}
              </p>
              <div className="space-y-2">
                {patients.map((p) => {
                  const s = SECTIONS.find((x) => x.key === p.stage)!
                  return (
                    <PatientCard
                      key={p.id}
                      p={p}
                      badgeLabel={s.badgeLabel}
                      badgeBg={`${s.accentColor}18`}
                      badgeColor={s.accentColor}
                    />
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  {page > 1 ? (
                    <Link
                      href={pageHref(params, { page: page - 1 })}
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
                      href={pageHref(params, { page: page + 1 })}
                      className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#E0E3E5] bg-white hover:bg-gray-50"
                      style={{ color: BRAND_COLORS.primaryTeal }}
                    >
                      Next →
                    </Link>
                  ) : <span />}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
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
  searchParams: Promise<{ q?: string; stage?: string; page?: string; scope?: string; from?: string; to?: string }>
}

const VALID_STAGES = new Set<StageKey>(["pre-consultation", "awaiting-treatment", "ongoing", "completed"])

/** Accepts only a real YYYY-MM-DD date; anything else is ignored. */
function validDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? undefined : value
}

export default async function PatientsPage({ searchParams }: Props) {
  const session = await requireSession()
  const { q = "", stage: rawStage, page: rawPage, scope, from, to } = await searchParams

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

      {/* Registration-date filter — applies to the staged list, not to search */}
      {!isSearching && (
        <Suspense fallback={null}>
          <PatientDateFilter from={validDate(from)} to={validDate(to)} />
        </Suspense>
      )}

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
          : (
            <PatientListView
              params={{ stage: activeStage, scopeAll, from: validDate(from), to: validDate(to), page }}
              branchId={branchFilter}
            />
          )
        }
      </Suspense>
    </div>
  )
}
