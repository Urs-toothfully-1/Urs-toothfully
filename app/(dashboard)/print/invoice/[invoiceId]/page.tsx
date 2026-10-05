import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { BRAND_COLORS } from "@/lib/constants"
import { PrintButtons } from "@/components/print/PrintButtons"
import { formatCurrency, formatDate } from "@/lib/utils"
import { invoiceService } from "@/server/services/invoice.service"

export const metadata: Metadata = { title: "Print Invoice" }

type Props = { params: Promise<{ invoiceId: string }> }

export default async function PrintInvoicePage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")
  const { invoiceId } = await params

  const invoice = await invoiceService.getById(invoiceId)
  if (!invoice || invoice.isDeleted) notFound()

  const subtotal = Number(invoice.subtotal)
  const discount = Number(invoice.discountAmount)
  const total = Number(invoice.total)
  const est = invoice.estimate
  const billedOnPlan = Number(est.invoicedTotal)
  const paidOnPlan = est.payments.reduce((s, p) => s + Number(p.amount), 0)
  const dueOnPlan = Math.max(0, billedOnPlan - paidOnPlan)
  const advanceHeld = Math.max(0, paidOnPlan - billedOnPlan)
  const cell = { borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; background: white !important; }
          aside, header, nav { display: none !important; }
          * { overflow: visible !important; height: auto !important; max-height: none !important; }
          .print-doc { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
      `}</style>

      <PrintButtons />

      <div className="print-doc max-w-[680px] mx-auto p-6">
        <div className="mb-4">
          <img src="/Header.jpg" alt="Header" className="w-full" />
        </div>

        <div className="text-center py-2 mb-4 rounded" style={{ backgroundColor: BRAND_COLORS.primaryTeal }}>
          <h1 className="text-lg font-bold text-white tracking-wider">TREATMENT INVOICE</h1>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <span style={{ color: BRAND_COLORS.borderDivider }}>Invoice No: </span>
            <strong style={{ color: BRAND_COLORS.primaryTeal }}>{invoice.invoiceNo}</strong>
          </div>
          <div className="text-right">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Date: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{formatDate(invoice.invoiceDate)}</strong>
          </div>
          <div>
            <span style={{ color: BRAND_COLORS.borderDivider }}>Branch: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{invoice.branch.name}</strong>
          </div>
          <div className="text-right">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Estimate: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{est.estimateNo}</strong>
          </div>
        </div>

        <div className="border-t-2 border-b mb-4" style={{ borderColor: BRAND_COLORS.primaryTeal }} />

        <div className="mb-4 p-3 rounded" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
          <p className="text-sm">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Patient: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{invoice.patient.fullName}</strong>
            <span className="ml-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>({invoice.patient.patientId})</span>
          </p>
          <p className="text-sm mt-1">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Mobile: </span>
            <span style={{ color: BRAND_COLORS.bodyText }}>{invoice.patient.mobile}</span>
          </p>
        </div>

        <table className="w-full text-sm mb-3" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
              <th className="py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">Treatment</th>
              <th className="py-2 px-2 text-left">Tooth</th>
              <th className="py-2 px-2 text-right">Qty</th>
              <th className="py-2 px-2 text-right">Rate</th>
              <th className="py-2 px-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id} style={cell}>
                <td className="py-2 px-2">{i + 1}</td>
                <td className="py-2 px-2 font-medium" style={{ color: BRAND_COLORS.bodyText }}>{it.treatmentName}</td>
                <td className="py-2 px-2">{it.toothNumber ?? "—"}</td>
                <td className="py-2 px-2 text-right">{it.quantity}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(Number(it.unitRate))}</td>
                <td className="py-2 px-2 text-right font-medium">{formatCurrency(Number(it.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-72 text-sm space-y-1 mb-4">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between" style={{ color: BRAND_COLORS.secondaryGreen }}>
              <span>Discount{invoice.discountIsPercent ? ` (${Number(invoice.discountValue)}%)` : ""}</span>
              <span>− {formatCurrency(discount)}</span>
            </div>
          )}
          <div
            className="flex justify-between p-2 rounded font-bold text-base"
            style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}10`, border: `2px solid ${BRAND_COLORS.primaryTeal}`, color: BRAND_COLORS.primaryTeal }}
          >
            <span>INVOICE TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Where this leaves the treatment plan */}
        <div className="text-xs p-3 rounded mb-4 grid grid-cols-3 gap-2" style={{ backgroundColor: BRAND_COLORS.lightBackground, color: BRAND_COLORS.bodyText }}>
          <div>Billed on plan: <strong>{formatCurrency(billedOnPlan)}</strong></div>
          <div>Paid on plan: <strong>{formatCurrency(paidOnPlan)}</strong></div>
          <div>
            {advanceHeld > 0 ? <>Advance held: <strong>{formatCurrency(advanceHeld)}</strong></> : <>Balance due: <strong>{formatCurrency(dueOnPlan)}</strong></>}
          </div>
        </div>

        {invoice.notes && <p className="text-sm mb-4" style={{ color: BRAND_COLORS.borderDivider }}>Note: {invoice.notes}</p>}

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Patient Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p style={{ color: BRAND_COLORS.borderDivider }}>Doctor ({invoice.createdBy.name})</p>
          </div>
        </div>

        <div className="mt-6">
          <img src="/fotter2.jpg" alt="Footer" className="w-full" />
        </div>
        <p className="text-center text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
          This is a computer-generated invoice.
        </p>
      </div>
    </>
  )
}
