import { getSession } from "@/lib/auth"
import { diagnosisService } from "@/server/services/diagnosis.service"
import type { PhraseSection } from "@/server/repositories/diagnosis.repository"

export interface LibraryGroup {
  group: string
  items: { id: string; name: string }[]
}

export interface LibraryResponse {
  recent: { id: string; name: string; group: string }[]
  mine: { id: string; name: string; group: string }[]
  groups: LibraryGroup[]
}

const SECTIONS: PhraseSection[] = ["DIAGNOSIS", "COMPLAINT"]

/**
 * The full phrase library for one prescription section, plus this doctor's
 * recent and self-added entries. Sent in one response so the picker can search
 * and scroll without a round-trip per keystroke.
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const raw = new URL(request.url).searchParams.get("section") ?? "DIAGNOSIS"
  const section = SECTIONS.find((s) => s === raw)
  if (!section) return Response.json({ error: "Unknown section" }, { status: 400 })

  try {
    const [all, recent, mine] = await Promise.all([
      diagnosisService.getLibrary(session.branchId, section),
      diagnosisService.getRecentDiagnoses(session.userId, session.branchId, section),
      diagnosisService.getMyDiagnoses(session.branchId, section),
    ])

    const groups: LibraryGroup[] = []
    for (const d of all) {
      const last = groups[groups.length - 1]
      if (last && last.group === d.specialty) last.items.push({ id: d.id, name: d.name })
      else groups.push({ group: d.specialty, items: [{ id: d.id, name: d.name }] })
    }

    const slim = (d: { id: string; name: string; specialty: string }) => ({
      id: d.id,
      name: d.name,
      group: d.specialty,
    })

    return Response.json({
      recent: recent.map(slim),
      mine: mine.map(slim),
      groups,
    } satisfies LibraryResponse)
  } catch (error) {
    console.error("Error loading clinical library:", error)
    return Response.json({ error: "Failed to load library" }, { status: 500 })
  }
}
