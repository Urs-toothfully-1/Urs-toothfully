import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { LibraryResponse } from "@/app/api/clinical-library/route"

/**
 * The branch's medicine list grouped by category, in the same shape as the
 * clinical library so both feed the one picker component.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const medicines = await prisma.medicine.findMany({
      where: { branchId: session.branchId, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true },
    })

    const groups: LibraryResponse["groups"] = []
    for (const m of medicines) {
      const last = groups[groups.length - 1]
      if (last && last.group === m.category) last.items.push({ id: m.id, name: m.name })
      else groups.push({ group: m.category, items: [{ id: m.id, name: m.name }] })
    }

    return Response.json({ recent: [], mine: [], groups } satisfies LibraryResponse)
  } catch (error) {
    console.error("Error loading medicines:", error)
    return Response.json({ error: "Failed to load medicines" }, { status: 500 })
  }
}
