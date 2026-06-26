import { Metadata } from "next"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TallyExportForm } from "@/components/accounting/TallyExportForm"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileSpreadsheet, History } from "lucide-react"

export const metadata: Metadata = { title: "Tally Export" }
export const dynamic = "force-dynamic"

export default async function TallyPage() {
  const session = await requireRole(["ADMIN"])

  const [branches, exportBatches] = await Promise.all([
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.exportBatch.findMany({
      orderBy: { exportedAt: "desc" },
      take: 10,
      include: {
        branch: { select: { name: true } },
        exportedBy: { select: { name: true } },
      },
    }),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: BRAND_COLORS.bodyText }}>
          Tally Export
        </h1>
        <p className="text-sm mt-0.5" style={{ color: BRAND_COLORS.borderDivider }}>
          Export approved accounting entries as CSV for Tally / Excel import
        </p>
      </div>

      {/* Export Form */}
      <Card className="border-[#CCCCCC] bg-white">
        <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
            <FileSpreadsheet className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />
            New Export
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <TallyExportForm branches={branches} defaultBranchId={session.branchId} />
        </CardContent>
      </Card>

      {/* CSV Format info */}
      <Card className="border-[#CCCCCC] bg-white">
        <CardContent className="p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: BRAND_COLORS.bodyText }}>
            CSV Columns
          </p>
          <p className="text-xs font-mono" style={{ color: BRAND_COLORS.borderDivider }}>
            Date · Receipt No · Patient Name · Patient ID · Payment Type · Mode · Ref · Amount · Branch · Notes
          </p>
          <p className="text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
            UTF-8 with BOM · Opens correctly in Microsoft Excel
          </p>
        </CardContent>
      </Card>

      {/* Export History */}
      {exportBatches.length > 0 && (
        <Card className="border-[#CCCCCC] bg-white">
          <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
              <History className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
              Export History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {(exportBatches as any[]).map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: BRAND_COLORS.lightBackground }}
                >
                  <div>
                    <span className="font-mono font-semibold" style={{ color: BRAND_COLORS.primaryTeal }}>
                      {batch.batchNo}
                    </span>
                    <span className="ml-3 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                      {batch.recordCount} entries · {batch.branch.name} ·{" "}
                      {formatDate(batch.fromDate)} to {formatDate(batch.toDate)}
                    </span>
                  </div>
                  <div className="text-right text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                    <p>{formatDate(batch.exportedAt)}</p>
                    <p>{batch.exportedBy.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
