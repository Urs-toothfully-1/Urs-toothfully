import { BRAND_COLORS } from "@/lib/constants"
import { NOTE_TYPE_LABELS } from "@/lib/queue-helpers"
import { formatDate } from "@/lib/utils"

interface Note {
  id: string
  noteType: string
  content: string
  toothNumbers?: string | null
  createdAt: Date | string
  doctor: { id: string; name: string }
  visit?: { id: string; visitNo: string; visitDate: Date | string } | null
}

export function ClinicalNoteCard({ note }: { note: Note }) {
  const typeColor: Record<string, { bg: string; color: string }> = {
    EXAMINATION: { bg: "#DBEAFE", color: "#1D4ED8" },
    DIAGNOSIS: { bg: "#FEE2E2", color: "#B91C1C" },
    TREATMENT_NOTE: { bg: "#D1FAE5", color: "#065F46" },
    FOLLOW_UP: { bg: "#EDE9FE", color: "#6D28D9" },
    GENERAL: { bg: BRAND_COLORS.lightBackground, color: BRAND_COLORS.borderDivider },
  }

  const style = typeColor[note.noteType] ?? typeColor.GENERAL

  return (
    <div
      className="rounded-lg border p-4 space-y-2"
      style={{ borderColor: BRAND_COLORS.lightBackground, backgroundColor: "#FAFAFA" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: style.bg, color: style.color }}
          >
            {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
          </span>
          <span className="text-xs font-medium" style={{ color: BRAND_COLORS.bodyText }}>
            {note.doctor.name}
          </span>
          {note.toothNumbers &&
            note.toothNumbers.split(",").map((t) => (
              <span
                key={t}
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(0,94,151,0.10)", color: BRAND_COLORS.primaryTeal }}
              >
                🦷 {t.trim()}
              </span>
            ))}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
            {formatDate(note.createdAt)}
          </p>
          {note.visit && (
            <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              {note.visit.visitNo}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: BRAND_COLORS.bodyText }}>
        {note.content}
      </p>
      <p className="text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
        Immutable — recorded {new Date(note.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  )
}
