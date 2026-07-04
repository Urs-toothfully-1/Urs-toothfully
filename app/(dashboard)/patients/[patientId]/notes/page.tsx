import { Metadata } from "next"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { clinicalNotesRepository } from "@/server/repositories/clinical-notes.repository"
import { visitRepository } from "@/server/repositories/visit.repository"
import { ClinicalNoteCard } from "@/components/clinical-notes/ClinicalNoteCard"
import { NewNoteForm } from "@/components/clinical-notes/NewNoteForm"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Lock } from "lucide-react"

export const metadata: Metadata = { title: "Clinical Notes" }

type Props = { params: Promise<{ patientId: string }> }

export default async function ClinicalNotesPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  // Only Doctors and Admins can see clinical notes
  if (session.role === "RECEPTIONIST") {
    return (
      <Card className="border-[#E0E3E5] bg-white">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Lock className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
          <p className="font-medium" style={{ color: BRAND_COLORS.bodyText }}>Access Restricted</p>
          <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
            Clinical notes are only visible to doctors and administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { patientId } = await params
  const canCreate = session.role === "ADMIN" || session.role === "DOCTOR"

  const [notes, visits] = await Promise.all([
    clinicalNotesRepository.findByPatient(patientId),
    visitRepository.findByPatient(patientId),
  ])

  const visitOptions = visits.map((v: any) => ({ id: v.id, visitNo: v.visitNo }))

  return (
    <div className="space-y-4">
      {/* New Note Form — Doctor and Admin only */}
      {canCreate && visitOptions.length > 0 && (
        <NewNoteForm patientId={patientId} visits={visitOptions} />
      )}

      {canCreate && visitOptions.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800">No visits yet</p>
            <p className="text-sm text-amber-700 mt-1">
              A visit must exist before you can add clinical notes. Add the patient to the queue first.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <Card className="border-[#E0E3E5] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Clinical Notes
            {notes.length > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded font-normal"
                style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}15`, color: BRAND_COLORS.primaryTeal }}
              >
                {notes.length} note{notes.length !== 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <FileText className="h-8 w-8" style={{ color: BRAND_COLORS.lightBackground }} />
              <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
                No clinical notes recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(notes as any[]).map((note) => (
                <ClinicalNoteCard
                  key={note.id}
                  note={{ ...note, visit: (note as any).visit }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
