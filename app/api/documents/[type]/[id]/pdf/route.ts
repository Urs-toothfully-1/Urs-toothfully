import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { generateDocumentPdf, type DocumentType } from "@/server/services/pdf.service"

const VALID_TYPES: DocumentType[] = ["estimate", "receipt", "prescription"]

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
    const message = err instanceof Error && err.message.includes("not found")
      ? err.message
      : "Failed to generate PDF"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
