import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { estimateRepository } from "@/server/repositories/estimate.repository"
import { lineDiscountAmount } from "@/lib/estimate-totals"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { BRAND_COLORS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toothLabel } from "@/lib/teeth"
import { PaymentStage } from "@/lib/payment-agreement"
import { PrintButtons } from "@/components/print/PrintButtons"
import { ShareActions } from "@/components/share/ShareActions"

export const metadata: Metadata = { title: "Print Estimate" }

type Props = { params: Promise<{ estimateId: string }> }

export default async function PrintEstimatePage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { estimateId } = await params
  const estimate = await estimateRepository.findById(estimateId)
  if (!estimate) notFound()

  const [agreement, estimateVersion] = await Promise.all([
    paymentAgreementService.getOrSuggest(estimateId),
    prisma.estimate.count({
      where: { patientId: estimate.patientId, isDeleted: false, createdAt: { lte: estimate.createdAt } },
    }),
  ])
  const agreementStages = (agreement.stages ?? []) as PaymentStage[]

  const total = Number(estimate.total)
  // Split the overall discount into the per-line part and the global part so the
  // printed summary reconciles with the net amounts now shown on each line.
  const lineDiscountTotal = (estimate.items as any[])
    .filter((i) => !i.isAlternative)
    .reduce((s, i) => s + lineDiscountAmount({ quantity: i.quantity, unitRate: Number(i.unitRate), discountValue: Number(i.discountValue || 0), discountIsPercent: i.discountIsPercent }), 0)
  const globalDiscountAmt = Math.max(0, Number(estimate.discountAmount ?? 0) - lineDiscountTotal)
  const paid = estimate.payments.reduce((s: number, p: { amount: unknown }) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)
  const received = agreementStages.filter((s) => s.received).reduce((sum, s) => sum + s.amount, 0)

  return (
    <>
      {/* Print trigger */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4; }
          html, body {
            margin: 0 !important; padding: 0 !important;
            height: auto !important; overflow: visible !important; background: white !important;
          }
          aside, header, nav { display: none !important; }
          * { overflow: visible !important; height: auto !important; max-height: none !important; }
          .print-doc { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
          /* A4 minus the 10mm @page margins — a half-empty estimate still fills
             the sheet so the footer lands at the bottom, not under the content. */
          .sheet { min-height: 277mm !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
        /* Fixed sheet template: content column grows, footer is pinned to the
           bottom edge. Same on screen so the preview matches the printout. */
        .sheet { display: flex; flex-direction: column; min-height: 1040px; }
        .sheet-footer { margin-top: auto; }
      `}</style>

      <PrintButtons />

      <div className="no-print fixed top-4 left-4 z-50">
        <ShareActions
          type="estimate"
          id={estimate.id}
          patientName={estimate.patient.fullName}
          patientMobile={estimate.patient.mobile}
          patientEmail={estimate.patient.email}
          docNo={`${estimate.estimateNo} · v${estimateVersion}`}
          branchName={estimate.branch.name}
        />
      </div>

      {/* Printable document */}
      <div className="print-doc max-w-[800px] mx-auto p-6">
        <div className="sheet">
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
              <span className="ml-1 font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>· v{estimateVersion}</span>
            </p>
            <p>
              <span style={{ color: BRAND_COLORS.borderDivider }}>Date: </span>
              <strong style={{ color: BRAND_COLORS.bodyText }}>{formatDate(estimate.documentDate ?? estimate.createdAt)}</strong>
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
              {["#", "Treatment", "Tooth", "Qty", "Unit Rate", "Discount", "Amount"].map((h) => (
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
            {(estimate.items as any[]).map((item, idx) => {
              const gross = Number(item.amount)
              const dv = Number(item.discountValue || 0)
              const lineDisc = lineDiscountAmount({
                quantity: item.quantity, unitRate: Number(item.unitRate),
                discountValue: dv, discountIsPercent: item.discountIsPercent,
              })
              const net = gross - lineDisc
              return (
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
                    {/* Named on the row itself, not only by the "or" on the amount:
                        the patient reads the treatment column first. */}
                    {item.isAlternative && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded"
                        style={{
                          fontSize: "10px", fontWeight: 600, letterSpacing: "0.03em",
                          border: `1px solid ${BRAND_COLORS.borderDivider}`,
                          color: BRAND_COLORS.borderDivider,
                        }}
                      >
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  <div style={{ color: BRAND_COLORS.borderDivider, fontSize: "11px" }}>
                    {item.category}
                  </div>
                </td>
                <td className="py-2 px-3" style={{ color: BRAND_COLORS.bodyText }}>
                  {toothLabel(item.toothNumber) || "—"}
                </td>
                <td className="py-2 px-3 text-center" style={{ color: BRAND_COLORS.bodyText }}>
                  {item.quantity}
                </td>
                <td className="py-2 px-3 text-right" style={{ color: BRAND_COLORS.bodyText }}>
                  {formatCurrency(Number(item.unitRate))}
                </td>
                {/* Per-line discount — shown as % or ₹ exactly as entered */}
                <td className="py-2 px-3 text-right" style={{ color: lineDisc > 0 ? "#DC2626" : BRAND_COLORS.borderDivider }}>
                  {dv > 0 ? (item.discountIsPercent ? `${dv}%` : formatCurrency(dv)) : "—"}
                </td>
                {/* Amount — net of the line discount; the original is struck through.
                    An option is greyed and tagged OPTIONAL; priced but not counted. */}
                <td
                  className="py-2 px-3 text-right font-semibold"
                  style={{ color: item.isAlternative ? BRAND_COLORS.borderDivider : BRAND_COLORS.bodyText }}
                >
                  {lineDisc > 0 ? (
                    <>
                      <span style={{ textDecoration: "line-through", color: BRAND_COLORS.borderDivider, fontWeight: 400, fontSize: "11px", marginRight: 6 }}>
                        {formatCurrency(gross)}
                      </span>
                      {formatCurrency(net)}
                    </>
                  ) : (
                    formatCurrency(gross)
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: BRAND_COLORS.borderDivider }}>Subtotal</span>
              <span style={{ color: BRAND_COLORS.bodyText }}>{formatCurrency(Number(estimate.subtotal))}</span>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="flex justify-between">
                <span style={{ color: BRAND_COLORS.borderDivider }}>Treatment discounts</span>
                <span style={{ color: "#DC2626" }}>-{formatCurrency(lineDiscountTotal)}</span>
              </div>
            )}
            {globalDiscountAmt > 0 && (
              <div className="flex justify-between">
                <span style={{ color: BRAND_COLORS.borderDivider }}>
                  {estimate.globalDiscountIsPercent && Number(estimate.globalDiscountValue) > 0
                    ? `Overall discount (${Number(estimate.globalDiscountValue)}%)`
                    : "Overall discount"}
                </span>
                <span style={{ color: "#DC2626" }}>-{formatCurrency(globalDiscountAmt)}</span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-base pt-2 border-t"
              style={{ borderColor: BRAND_COLORS.primaryTeal, color: BRAND_COLORS.primaryTeal }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {/* Only shown when an advance is actually required. With the
                advance_percent setting at 0 the line is omitted entirely rather
                than printing "Advance Required ₹0" on the patient's copy. */}
            {Number(estimate.advanceRequired) > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: BRAND_COLORS.borderDivider }}>Advance Required</span>
                <span style={{ color: BRAND_COLORS.secondaryGreen, fontWeight: 600 }}>
                  {formatCurrency(Number(estimate.advanceRequired))}
                </span>
              </div>
            )}
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
        <div className="grid grid-cols-3 gap-8 mt-8 text-sm">
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Patient Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Authorized Signatory</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-8 flex items-end justify-center overflow-hidden">
              {estimate.doctor.signatureData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={estimate.doctor.signatureData} alt="Signature" style={{ maxHeight: 30, maxWidth: "100%", objectFit: "contain" }} />
              ) : null}
            </div>
            <p style={{ color: BRAND_COLORS.borderDivider }}>Dr. Signature</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sheet-footer pt-8 relative">
          <img src="/fotter2.jpg" alt="Footer" className="w-full" />
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 120, height: 12,
            backgroundColor: "#8DC21F",
            clipPath: "polygon(12px 0%, 100% 0%, 100% 100%, 0% 100%)",
          }} />
        </div>
        </div>

        {/* ── PAYMENT AGREEMENT — new page on print ─────────── */}
        <div className="sheet" style={{ pageBreakBefore: "always", paddingTop: "0" }}>
          {/* Header repeated */}
          <div className="mb-4">
            <img src="/Header.jpg" alt="Ur's Toothfully Header" className="w-full" />
          </div>

          {/* Agreement title */}
          <div
            className="mb-4 pb-3 border-b-2"
            style={{ borderColor: BRAND_COLORS.primaryTeal }}
          >
            <h2 className="text-xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
              DENTAL TREATMENT PAYMENT AGREEMENT
            </h2>
            <div className="grid grid-cols-3 gap-4 mt-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              <div>
                <span>Patient: </span>
                <strong style={{ color: BRAND_COLORS.bodyText }}>{estimate.patient.fullName}</strong>
              </div>
              <div>
                <span>Estimate No: </span>
                <strong style={{ color: BRAND_COLORS.bodyText }}>{estimate.estimateNo}</strong>
              </div>
              <div>
                <span>Treatment Cost: </span>
                <strong style={{ color: BRAND_COLORS.primaryTeal }}>{formatCurrency(total)}</strong>
              </div>
            </div>
          </div>

          {/* Payment schedule table */}
          <table className="w-full text-sm mb-4" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: BRAND_COLORS.secondaryGreen, color: "white" }}>
                {["Payment Stage", "Amount (₹)", "Due Date", "Received"].map((h) => (
                  <th key={h} className="py-2 px-3 text-left font-semibold" style={{ fontSize: "12px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agreementStages.map((stage, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid #E0E3E5",
                    backgroundColor: stage.received ? "#EFF9F4" : idx % 2 === 0 ? "white" : "#FAFAFA",
                  }}
                >
                  <td className="py-2.5 px-3" style={{ color: BRAND_COLORS.bodyText }}>{stage.name}</td>
                  <td className="py-2.5 px-3 font-semibold" style={{ color: BRAND_COLORS.bodyText }}>
                    ₹{stage.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: BRAND_COLORS.bodyText }}>
                    {stage.dueDate
                      ? new Date(stage.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "_____________"}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {stage.received
                      ? <span style={{ color: BRAND_COLORS.secondaryGreen, fontWeight: 700 }}>✓ Received</span>
                      : <span style={{ color: BRAND_COLORS.borderDivider }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${BRAND_COLORS.secondaryGreen}` }}>
                <td className="py-2 px-3 font-bold" style={{ color: BRAND_COLORS.bodyText }}>Total Treatment Cost</td>
                <td className="py-2 px-3 font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
                  ₹{total.toLocaleString("en-IN")}
                </td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="py-1 px-3 font-semibold" style={{ color: BRAND_COLORS.bodyText }}>Total Amount Received</td>
                <td className="py-1 px-3 font-semibold" style={{ color: BRAND_COLORS.secondaryGreen }}>
                  ₹{received.toLocaleString("en-IN")}
                </td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="py-1 px-3 font-bold" style={{ color: "#C2410C" }}>Balance Outstanding</td>
                <td className="py-1 px-3 font-bold" style={{ color: "#C2410C" }}>
                  ₹{Math.max(0, total - received).toLocaleString("en-IN")}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>

          {/* Patient declaration */}
          <div
            className="mb-6 p-3 rounded text-xs"
            style={{ backgroundColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}
          >
            <strong>Patient Declaration:</strong> I have understood the proposed treatment, estimated cost,
            payment schedule, and the above terms and conditions. I agree to make payments as per the
            agreed schedule.
          </div>

          {/* Signature block */}
          <div className="grid grid-cols-3 gap-8 text-xs">
            <div>
              <div className="border-b border-gray-400 mb-1 h-10" />
              <p style={{ color: BRAND_COLORS.borderDivider }}>Patient Name</p>
              <p className="font-semibold mt-0.5" style={{ color: BRAND_COLORS.bodyText }}>
                {estimate.patient.fullName}
              </p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1 h-10">
                {agreement.patientSignedAt && (
                  <p className="text-xs" style={{ color: BRAND_COLORS.bodyText }}>
                    Date: {new Date(agreement.patientSignedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <p style={{ color: BRAND_COLORS.borderDivider }}>Patient Signature &amp; Date</p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1 h-10" />
              <p style={{ color: BRAND_COLORS.borderDivider }}>Clinic Representative</p>
              {agreement.clinicRepresentative && (
                <p className="font-semibold mt-0.5" style={{ color: BRAND_COLORS.bodyText }}>
                  {agreement.clinicRepresentative}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sheet-footer pt-8 relative">
            <img src="/fotter2.jpg" alt="Footer" className="w-full" />
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 120, height: 12,
              backgroundColor: "#8DC21F",
              clipPath: "polygon(12px 0%, 100% 0%, 100% 100%, 0% 100%)",
            }} />
          </div>
        </div>
      </div>
    </>
  )
}
