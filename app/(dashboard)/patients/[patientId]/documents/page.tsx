import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShareActions } from "@/components/share/ShareActions"
import { ClipboardList, FileText, FolderOpen, Pencil, Printer, Receipt } from "lucide-react"
import type { DocumentType } from "@/server/services/pdf.service"

export const metadata: Metadata = { title: "Documents" }

type Props = { params: Promise<{ patientId: string }> }

export default async function DocumentsPage({ params }: Props) {
  const session = await requireSession()
  const { patientId } = await params

  // Editing is open to any doctor/admin from here, with no queue involved — the
  // point of this page is reaching a document without the patient being in a
  // live visit. Receipts stay read-only: payments are corrected by adjustment,
  // never by editing history.
  const canEdit = session.role === "ADMIN" || session.role === "DOCTOR"

  const patient = await prisma.patient.findUnique({
    where: { id: patientId, isDeleted: false },
    select: { id: true, patientId: true, fullName: true, mobile: true, email: true },
  })
  if (!patient) notFound()

  const [estimates, receipts, prescriptions] = await Promise.all([
    prisma.estimate.findMany({
      where: { patientId, isDeleted: false },
      select: { id: true, estimateNo: true, createdAt: true, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.receipt.findMany({
      where: { patientId },
      select: { id: true, receiptNo: true, issuedAt: true, branch: { select: { name: true } } },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.prescriptionRecord.findMany({
      where: { patientId, mode: { not: "PRINT_ONLY" } },
      select: { id: true, visitId: true, createdAt: true, visit: { select: { branch: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  type Row = {
    key: string
    type: DocumentType
    label: string
    docNo: string
    date: Date
    branchName: string
    printHref: string
    /** Omitted for documents that are not editable (receipts). */
    editHref?: string
    shareId: string
    icon: React.ReactNode
  }

  // Editors return here rather than to the estimate wizard, so the trail back
  // from this page is not a dead end.
  const backHere = encodeURIComponent(`/patients/${patientId}/documents`)

  const rows: Row[] = [
    ...estimates.map((e): Row => ({
      key: `est-${e.id}`,
      type: "estimate",
      label: "Treatment Estimate",
      docNo: e.estimateNo,
      date: e.createdAt,
      branchName: e.branch.name,
      printHref: `/print/estimate/${e.id}`,
      editHref: `/doctor/estimate/${e.id}/edit?return=${backHere}`,
      shareId: e.id,
      icon: <FileText className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />,
    })),
    ...receipts.map((r): Row => ({
      key: `rcp-${r.id}`,
      type: "receipt",
      label: "Payment Receipt",
      docNo: r.receiptNo,
      date: r.issuedAt,
      branchName: r.branch.name,
      printHref: `/print/receipt/${r.id}`,
      shareId: r.id,
      icon: <Receipt className="h-4 w-4" style={{ color: BRAND_COLORS.secondaryGreen }} />,
    })),
    ...prescriptions.map((p): Row => ({
      key: `rx-${p.id}`,
      type: "prescription",
      label: "Prescription",
      docNo: `RX-${patient.patientId}`,
      date: p.createdAt,
      branchName: p.visit.branch.name,
      printHref: `/print/prescription/${p.visitId}`,
      editHref: `/doctor/prescription/${p.id}`,
      shareId: p.id,
      icon: <ClipboardList className="h-4 w-4" style={{ color: "#7C3AED" }} />,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <Card className="border-[#E0E3E5] bg-white">
      <CardHeader className="pb-3 border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
        <CardTitle className="text-base flex items-center gap-2" style={{ color: BRAND_COLORS.bodyText }}>
          <FolderOpen className="h-4 w-4" style={{ color: BRAND_COLORS.primaryTeal }} />
          Documents
          <span className="text-xs font-normal" style={{ color: BRAND_COLORS.borderDivider }}>
            {rows.length} document{rows.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FolderOpen className="h-10 w-10" style={{ color: BRAND_COLORS.lightBackground }} />
            <p className="text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
              No documents yet — estimates, receipts and prescriptions will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                  {["Document", "Number", "Date", "Branch", "Actions"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-xs font-semibold" style={{ color: BRAND_COLORS.borderDivider }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b" style={{ borderColor: BRAND_COLORS.lightBackground }}>
                    <td className="py-2.5 px-2">
                      <span className="flex items-center gap-2 font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                        {row.icon}
                        {row.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs" style={{ color: BRAND_COLORS.primaryTeal }}>
                      {row.docNo}
                    </td>
                    <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                      {formatDate(row.date)}
                    </td>
                    <td className="py-2.5 px-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
                      {row.branchName}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        {canEdit && row.editHref && (
                          <Link
                            href={row.editHref}
                            className="flex items-center justify-center h-8 w-8 rounded-md border hover:bg-slate-50"
                            style={{ borderColor: BRAND_COLORS.borderLight, color: BRAND_COLORS.primaryTeal }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        )}
                        <Link
                          href={row.printHref}
                          target="_blank"
                          className="flex items-center justify-center h-8 w-8 rounded-md border hover:bg-slate-50"
                          style={{ borderColor: BRAND_COLORS.borderLight, color: BRAND_COLORS.secondaryText }}
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                        <ShareActions
                          type={row.type}
                          id={row.shareId}
                          patientName={patient.fullName}
                          patientMobile={patient.mobile}
                          patientEmail={patient.email}
                          docNo={row.docNo}
                          branchName={row.branchName}
                          compact
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
