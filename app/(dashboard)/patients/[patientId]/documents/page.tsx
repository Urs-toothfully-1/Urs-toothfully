import { Metadata } from "next"
import { requireSession } from "@/lib/auth"
import { BRAND_COLORS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"
import { FolderOpen } from "lucide-react"

export const metadata: Metadata = { title: "Documents" }

export default async function DocumentsPage() {
  await requireSession()
  return (
    <Card className="border-[#CCCCCC] bg-white">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <FolderOpen className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
        <p className="font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Documents</p>
        <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
          X-rays, photos, consent forms and reports — upload UI coming in V2.
        </p>
      </CardContent>
    </Card>
  )
}
