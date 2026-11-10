"use server"

import { revalidatePath } from "next/cache"
import { requireRole, gate } from "@/lib/auth"
import { clinicalNotesRepository } from "@/server/repositories/clinical-notes.repository"
import { parseReceiptDate } from "@/lib/payment-date"

export type NoteFormState = {
  success?: boolean
  error?: string
}

export async function createClinicalNoteAction(
  patientId: string,
  _prev: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).then(gate("clinicalNotes")).catch(() => null)
  if (!session) return { error: "Only doctors and admins can create clinical notes." }

  const visitId = formData.get("visitId")?.toString()
  const noteType = formData.get("noteType")?.toString() || "GENERAL"
  const content = formData.get("content")?.toString()?.trim()
  const toothNumbers = formData.get("toothNumbers")?.toString()?.trim().slice(0, 120) || null
  // Past date → back-dated note; today/future/blank → recorded now.
  const createdAt = parseReceiptDate(formData.get("noteDate")?.toString())

  if (!visitId || !content) {
    return { error: "Visit and note content are required." }
  }

  if (content.length < 5) {
    return { error: "Note content is too short." }
  }

  try {
    await clinicalNotesRepository.create({
      patientId,
      visitId,
      doctorId: session.userId,
      noteType,
      content,
      toothNumbers,
      createdAt,
    })

    revalidatePath(`/patients/${patientId}/notes`)
    return { success: true }
  } catch {
    return { error: "Failed to save clinical note." }
  }
}
