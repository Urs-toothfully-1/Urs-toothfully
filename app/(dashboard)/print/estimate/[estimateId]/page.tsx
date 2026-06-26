import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { BRAND_COLORS, APP_NAME, APP_TAGLINE } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PrintButtons } from "@/components/print/PrintButtons"

export const metadata: Metadata = { title: "Print Estimate" }

type Props = { params: Promise<{ estimateId: string }> }

export default async function PrintEstimatePage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { estimateId } = await params
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()

  const total = Number(estimate.total)
  const paid = estimate.payments.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)

  return (
    <>
      {/* Print trigger */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 10mm; size: A4; }
          aside, header { display: none !important; }
          main { padding: 0 !important; background: white !important; }
          .flex.h-screen { display: block !important; }
          .flex-1.overflow-hidden { display: block !important; width: 100% !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
      `}</style>

      <PrintButtons />

      {/* Printable document */}
      <div className="max-w-[800px] mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <img src="/Header.jpg" alt="Ur's Toothfully Header" className="w-full" />
        </div>

        {/* Title + Estimate Info */}
        <div
          className="flex justify-between items-start mb-5 pb-4 border-b-2"
          style={{ borderColor: BRAND_COLORS.primaryTeal }}
        >
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: BRAND_COLORS.primaryTeal }}
            >
              TREATMENT ESTIMATE
            </h1>
            <p className="text-sm mt-1" style={{ color: BRAND_COLORS.borderDivider }}>
              {estimate.branch.name} Branch
            </p>
          </div>
          <div className="text-right text-sm space-y-1">
            <p>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Estimate No: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{estimate.estimateNo}</strong>
            </p>
            <p>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Date: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{formatDate(estimate.createdAt)}</strong>
            </p>
            <p>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Doctor: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{estimate.doctor.name}</strong>
            </p>
          </div>
        </div>

        {/* Patient Info */}
        <div
          className="mb-5 p-3 rounded"
          style={{ backgroundColor: BRAND_COLORS.lightBackground }}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Patient Name: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{estimate.patient.fullName}</strong>
            </div>
            <div>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Patient ID: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{(estimate as any).patient?.patientId ?? "—"}</strong>
            </div>
            <div>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Visit No: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{(estimate as any).visit?.visitNo ?? "—"}</strong>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-5 text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: BRAND_COLORS.primaryTeal, color: "white" }}>
              {["#", "Treatment", "Tooth", "Qty", "Unit Rate", "Amount"].map((h) => (
                <th
                  key={h}
                  className="py-2 px-3 text-left font-semibold"
                  style={{ fontSize: "12px" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(estimate.items as any[]).map((item, idx) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: `1px solid ${BRAND_COLORS.lightBackground}`,
                  backgroundColor: idx % 2 === 0 ? "white" : "#FAFAFA",
                }}
              >
                <td className="py-2 px-3" style={{ color: BRAND_COLORS.borderDivider }}>
                  {idx + 1}
                </td>
                <td className="py-2 px-3">
                  <div style={{ color: BRAND_COLORS.bodyText, fontWeight: 500 }}>
                    {item.treatmentName}
                  </div>
                  <div style={{ color: BRAND_COLORS.borderDivider, fontSize: "11px" }}>
                    {item.category}
                  </div>
                </td>
                <td className="py-2 px-3" style={{ color: BRAND_COLORS.bodyText }}>
                  {item.toothNumber || "—"}
                </td>
                <td className="py-2 px-3 text-center" style={{ color: BRAND_COLORS.bodyText }}>
                  {item.quantity}
                </td>
                <td className="py-2 px-3 text-right" style={{ color: BRAND_COLORS.bodyText }}>
                  {formatCurrency(Number(item.unitRate))}
                </td>
                <td
                  className="py-2 px-3 text-right font-semibold"
                  style={{ color: BRAND_COLORS.bodyText }}
                >
                  {formatCurrency(Number(item.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Subtotal</span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(Number(estimate.subtotal))}</span>
            </div>
            {estimate.discountAmount && Number(estimate.discountAmount) > 0 && (
              <div className="flex justify-between">
                <span style={{ color: BRAND_COLORS.borderDivider }}>
                  Discount ({Number(estimate.discountPercent)}%)
                </span>
                <span style={{ color: "#DC2626" }}>-{formatCurrency(Number(estimate.discountAmount))}</span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-base pt-2 border-t"
              style={{ borderColor: BRAND_COLORS.primaryTeal, color: BRAND_COLORS.primaryTeal }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Advance Required</span>
              <span style={{ color: BRAND_COLORS.secondaryGreen, fontWeight: 600 }}>
                {formatCurrency(Number(estimate.advanceRequired))}
              </span>
            </div>
            {paid > 0 && (
              <>
                <div className="flex justify-between">
                  <span style={{ color: BRAND_COLORS.borderDivider }}>Amount Paid</span>
                  <span style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(paid)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span style={{ color: balance > 0 ? "#C2410C" : BRAND_COLORS.secondaryGreen }}>
                    {balance > 0 ? "Balance Due" : "Paid in Full"}
                  </span>
                  <span style={{ color: balance > 0 ? "#C2410C" : BRAND_COLORS.secondaryGreen }}>
                    {balance > 0 ? formatCurrency(balance) : "✓"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {estimate.notes && (
          <div
            className="mb-5 p-3 rounded text-sm"
            style={{ backgroundColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
          >
            <strong>Notes:</strong> {estimate.notes}
          </div>
        )}

        {/* Signature line */}
        <div className="grid grid-cols-2 gap-10 mt-8 text-sm">
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Patient Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Authorized Signatory</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8">
          <img src="/fotter-1.jpg" alt="Footer" className="w-full" />
        </div>
      </div>
    </>
  )
}
