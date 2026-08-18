import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const templates = await prisma.medicineTemplate.findMany({
      where: { branchId: session.branchId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            medicine: true,
            frequency: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const formatted = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      items: t.items,
    }))

    return Response.json(formatted)
  } catch (error) {
    console.error("Error fetching medicine templates:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch templates" }), {
      status: 500,
    })
  }
}
