import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { BRAND_COLORS } from "@/lib/constants"
import { PrintButtons } from "@/components/print/PrintButtons"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toothLabel } from "@/lib/teeth"
import { amountInWords } from "@/lib/amount-in-words"
import { invoiceService } from "@/server/services/invoice.service"

export const metadata: Metadata = { title: "Print Invoice" }

type Props = { params: Promise<{ invoiceId: string }> }

const muted = { color: BRAND_COLORS.borderDivider }
const body = { color: BRAND_COLORS.bodyText }

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
  const signer = invoice.createdBy
  const signerName = signer.role === "DOCTOR" ? `Dr. ${signer.name.replace(/^Dr\.?\s*/i, "")}` : signer.name

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; background: white !important; }
          aside, header, nav { display: none !important; }
          * { overflow: visible !important; max-height: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-doc { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
          .sheet { min-height: 277mm !important; }
          .logo-crop { overflow: hidden !important; height: 118px !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
        .sheet { display: flex; flex-direction: column; min-height: 1040px; }
        .sheet-footer { margin-top: auto; }
      `}</style>

      <PrintButtons />

      <div className="print-doc max-w-[800px] mx-auto p-6 bg-white">
        <div className="sheet">
          {/* ── Header: clinic logo (left) · INVOICE + numbers (right) ── */}
          <div className="flex items-start justify-between gap-6 pb-4 border-b-4" style={{ borderColor: BRAND_COLORS.primaryTeal }}>
            {/* Logo panel cropped from the letterhead (no "Estimate" title baked in) */}
            <div className="logo-crop rounded-md" style={{ width: 216, height: 118, overflow: "hidden", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hader1.jpg" alt="Ur's Toothfully" style={{ width: 561, maxWidth: "none", display: "block" }} />
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-bold tracking-[0.2em]" style={{ color: BRAND_COLORS.primaryTeal }}>INVOICE</h1>
              <table className="ml-auto mt-3 text-sm">
                <tbody>
                  <tr><td className="pr-3 text-right" style={muted}>Invoice No.</td><td className="font-bold text-right" style={body}>{invoice.invoiceNo}</td></tr>
                  <tr><td className="pr-3 text-right" style={muted}>Invoice Date</td><td className="font-semibold text-right" style={body}>{formatDate(invoice.invoiceDate)}</td></tr>
                  <tr><td className="pr-3 text-right" style={muted}>Treatment Plan</td><td className="text-right" style={body}>{est.estimateNo}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── From / Bill to ── */}
          <div className="grid grid-cols-2 gap-6 py-5 text-sm">
            <div>
              <p className="text-[11px] font-bold tracking-wider mb-1" style={{ color: BRAND_COLORS.primaryTeal }}>FROM</p>
              <p className="font-bold" style={body}>Ur&apos;s Toothfully — {invoice.branch.name}</p>
              <p style={muted}>{invoice.branch.address}</p>
              <p style={muted}>Phone: {invoice.branch.phone}</p>
              {invoice.branch.email && <p style={muted}>{invoice.branch.email}</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider mb-1" style={{ color: BRAND_COLORS.primaryTeal }}>BILL TO</p>
              <p className="font-bold" style={body}>{invoice.patient.fullName}</p>
              <p style={muted}>Patient ID: {invoice.patient.patientId}</p>
              <p style={muted}>Mobile: {invoice.patient.mobile}</p>
              {invoice.patient.address && <p style={muted}>{invoice.patient.address}</p>}
            </div>
          </div>

          {/* ── Line items ── */}
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: BRAND_COLORS.primaryTeal, color: "white" }}>
                <th className="py-2 px-3 text-left w-10">#</th>
                <th className="py-2 px-3 text-left">Description</th>
                <th className="py-2 px-3 text-center w-14">Qty</th>
                <th className="py-2 px-3 text-right w-28">Rate</th>
                <th className="py-2 px-3 text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #E0E3E5", backgroundColor: i % 2 ? "#FAFAFA" : "white" }}>
                  <td className="py-2.5 px-3 align-top" style={muted}>{i + 1}</td>
                  <td className="py-2.5 px-3 align-top">
                    <p className="font-medium" style={body}>{it.treatmentName}</p>
                    {toothLabel(it.toothNumber) && <p className="text-xs" style={muted}>{toothLabel(it.toothNumber)}</p>}
                  </td>
                  <td className="py-2.5 px-3 text-center align-top" style={body}>{it.quantity}</td>
                  <td className="py-2.5 px-3 text-right align-top" style={body}>{formatCurrency(Number(it.unitRate))}</td>
                  <td className="py-2.5 px-3 text-right align-top font-semibold" style={body}>{formatCurrency(Number(it.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totals ── */}
          <div className="flex justify-between gap-6 mt-4">
            <div className="text-xs max-w-[55%] pt-1" style={muted}>
              <p className="font-semibold" style={body}>Amount in words</p>
              <p className="mt-0.5">{amountInWords(total)}</p>
              {invoice.notes && (
                <>
                  <p className="font-semibold mt-3" style={body}>Notes</p>
                  <p className="mt-0.5">{invoice.notes}</p>
                </>
              )}
            </div>
            <table className="text-sm w-72">
              <tbody>
                <tr><td className="py-1" style={muted}>Subtotal</td><td className="py-1 text-right" style={body}>{formatCurrency(subtotal)}</td></tr>
                {discount > 0 && (
                  <tr>
                    <td className="py-1" style={muted}>Discount{invoice.discountIsPercent ? ` (${Number(invoice.discountValue)}%)` : ""}</td>
                    <td className="py-1 text-right" style={{ color: "#DC2626" }}>− {formatCurrency(discount)}</td>
                  </tr>
                )}
                <tr style={{ backgroundColor: BRAND_COLORS.primaryTeal, color: "white" }}>
                  <td className="py-2 px-2 font-bold">TOTAL</td>
                  <td className="py-2 px-2 text-right font-bold text-base">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Account summary for this treatment plan ── */}
          <div className="mt-5 rounded-md border text-xs grid grid-cols-3" style={{ borderColor: "#E0E3E5" }}>
            <div className="p-2.5 border-r" style={{ borderColor: "#E0E3E5" }}>
              <p style={muted}>Total billed ({est.estimateNo})</p>
              <p className="font-bold text-sm" style={body}>{formatCurrency(billedOnPlan)}</p>
            </div>
            <div className="p-2.5 border-r" style={{ borderColor: "#E0E3E5" }}>
              <p style={muted}>Total paid</p>
              <p className="font-bold text-sm" style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(paidOnPlan)}</p>
            </div>
            <div className="p-2.5">
              {advanceHeld > 0 ? (
                <><p style={muted}>Advance remaining</p><p className="font-bold text-sm" style={{ color: BRAND_COLORS.secondaryGreen }}>{formatCurrency(advanceHeld)}</p></>
              ) : (
                <><p style={muted}>Balance due</p><p className="font-bold text-sm" style={{ color: dueOnPlan > 0 ? "#C2410C" : BRAND_COLORS.secondaryGreen }}>{dueOnPlan > 0 ? formatCurrency(dueOnPlan) : "Nil"}</p></>
              )}
            </div>
          </div>

          {/* ── Signature ── */}
          <div className="flex justify-end mt-10">
            <div className="w-56 text-center text-xs">
              <div className="h-12 flex items-end justify-center border-b border-gray-400">
                {signer.signatureData && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signer.signatureData} alt="Signature" style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain" }} />
                )}
              </div>
              <p className="mt-1 font-semibold" style={body}>{signerName}</p>
              {signer.doctorRegNo && <p style={muted}>Reg. No. {signer.doctorRegNo}</p>}
              <p style={muted}>Authorised Signatory</p>
            </div>
          </div>

          <div className="sheet-footer pt-6">
            <p className="text-center text-[11px] mb-2" style={muted}>
              Thank you for choosing Ur&apos;s Toothfully. This is a computer-generated invoice.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fotter2.jpg" alt="Footer" className="w-full" />
          </div>
        </div>
      </div>
    </>
  )
}
