import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BRAND_COLORS } from "@/lib/constants"
import { PenLine } from "lucide-react"
import { SignatureUploader } from "@/components/signature/SignatureUploader"

export const metadata: Metadata = { title: "My Signature" }
export const dynamic = "force-dynamic"

export default async function SignaturePage() {
  const session = await requireRole(["DOCTOR"])
  const doctor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { signatureData: true },
  })

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: BRAND_COLORS.bodyText }}>
          My Signature
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          This signature is added to prescriptions and documents for the patients you see.
        </p>
      </div>

      <Card className="border-[#E0E3E5]">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <PenLine className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
            Digital Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <SignatureUploader initial={doctor?.signatureData ?? null} />
        </CardContent>
      </Card>
    </div>
  )
}
