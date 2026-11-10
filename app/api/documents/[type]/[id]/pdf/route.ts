import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { canSeePatient } from "@/server/services/patient-scope.service"
import { getSession } from "@/lib/auth"
import { generateDocumentPdf, type DocumentType } from "@/server/services/pdf.service"

const VALID_TYPES: DocumentType[] = ["estimate", "receipt", "prescription"]

// Headless Chromium cold start + page render can exceed the default timeout
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { type, id } = await params
  if (!VALID_TYPES.includes(type as DocumentType)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 })
  }
  // PDFs may come from a cache, so check access here, not only on the print page.
  if ((type === "estimate" && !session.perms.prices) || (type === "receipt" && !session.perms.payments)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!session.perms.allPatients) {
    const owner =
      type === "estimate" ? await prisma.estimate.findUnique({ where: { id }, select: { patientId: true } })
      : type === "receipt" ? await prisma.receipt.findUnique({ where: { id }, select: { patientId: true } })
      : await prisma.prescriptionRecord.findUnique({ where: { id }, select: { patientId: true } })
    if (!owner || !(await canSeePatient(session, owner.patientId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const { buffer, fileName } = await generateDocumentPdf({
      type: type as DocumentType,
      id,
      baseUrl: request.nextUrl.origin,
      cookieHeader: request.headers.get("cookie") ?? "",
      generatedById: session.userId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("PDF generation failed:", err)
    const isUnavailable = err instanceof Error && err.message.startsWith("PDF generation is not available")
    const message = isUnavailable
      ? err.message
      : err instanceof Error && err.message.includes("not found")
        ? err.message
        : "Failed to generate PDF"
    return NextResponse.json({ error: message }, { status: isUnavailable ? 503 : 500 })
  }
}
