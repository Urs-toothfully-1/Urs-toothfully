"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { clinicalNotesRepository } from "@/server/repositories/clinical-notes.repository"

export type NoteFormState = {
  success?: boolean
  error?: string
}

export async function createClinicalNoteAction(
  patientId: string,
  _prev: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { error: "Only doctors and admins can create clinical notes." }

  const visitId = formData.get("visitId")?.toString()
  const noteType = formData.get("noteType")?.toString() || "GENERAL"
  const content = formData.get("content")?.toString()?.trim()

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
    })

    revalidatePath(`/patients/${patientId}/notes`)
    return { success: true }
  } catch {
    return { error: "Failed to save clinical note." }
  }
}
