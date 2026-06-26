import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BRAND_COLORS } from "@/lib/constants"
import { PrintButtons } from "@/components/print/PrintButtons"
import { formatCurrency, formatDate } from "@/lib/utils"

export const metadata: Metadata = { title: "Print Receipt" }

type Props = { params: Promise<{ receiptId: string }> }

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation Fee",
  TREATMENT: "Treatment Payment",
  ADVANCE: "Advance Payment",
  ADJUSTMENT: "Adjustment",
}

const MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI / Online Transfer",
  CARD: "Debit / Credit Card",
  BANK_TRANSFER: "Bank Transfer",
}

export default async function PrintReceiptPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { receiptId } = await params

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      patient: { select: { patientId: true, fullName: true, mobile: true } },
      branch: { select: { name: true, address: true, phone: true } },
      issuedBy: { select: { name: true } },
      payment: {
        include: {
          estimate: { select: { estimateNo: true } },
          visit: { select: { visitNo: true } },
          collectedBy: { select: { name: true } },
        },
      },
    },
  })

  if (!receipt) notFound()

  const payment = receipt.payment
  const amount = Number(payment.amount)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 8mm; size: A4; }
          html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; background: white !important; }
          aside, header, nav { display: none !important; }
          div, main, section { overflow: visible !important; }
          .h-screen, main { height: auto !important; }
          .print-doc { zoom: 0.88; max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
          .print-doc img:first-of-type { max-height: 64px !important; object-fit: contain; object-position: left; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
      `}</style>

      <PrintButtons />

      {/* Receipt document */}
      <div className="print-doc max-w-[600px] mx-auto p-6">
        {/* Header */}
        <div className="mb-4">
          <img src="/Header.jpg" alt="Header" className="w-full" />
        </div>

        {/* Title */}
        <div
          className="text-center py-2 mb-4 rounded"
          style={{ backgroundColor: BRAND_COLORS.primaryTeal }}
        >
          <h1 className="text-lg font-bold text-white tracking-wider">RECEIPT</h1>
        </div>

        {/* Receipt meta */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <span style={{ color: BRAND_COLORS.borderDivider }}>Receipt No: </span>
            <strong style={{ color: BRAND_COLORS.primaryTeal }}>{receipt.receiptNo}</strong>
          </div>
          <div className="text-right">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Date: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{formatDate(receipt.issuedAt)}</strong>
          </div>
          <div>
            <span style={{ color: BRAND_COLORS.borderDivider }}>Branch: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{receipt.branch.name}</strong>
          </div>
          <div className="text-right">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Issued by: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{receipt.issuedBy.name}</strong>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-b mb-4" style={{ borderColor: BRAND_COLORS.primaryTeal }} />

        {/* Patient */}
        <div className="mb-4 p-3 rounded" style={{ backgroundColor: BRAND_COLORS.lightBackground }}>
          <p className="text-sm">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Patient: </span>
            <strong style={{ color: BRAND_COLORS.bodyText }}>{receipt.patient.fullName}</strong>
            <span className="ml-2 text-xs" style={{ color: BRAND_COLORS.borderDivider }}>
              ({receipt.patient.patientId})
            </span>
          </p>
          <p className="text-sm mt-1">
            <span style={{ color: BRAND_COLORS.borderDivider }}>Mobile: </span>
            <span style={{ color: BRAND_COLORS.bodyText }}>{receipt.patient.mobile}</span>
          </p>
        </div>

        {/* Payment details */}
        <table className="w-full text-sm mb-4" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
              <td className="py-2" style={{ color: BRAND_COLORS.borderDivider }}>Payment Type</td>
              <td className="py-2 text-right font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                {PAYMENT_TYPE_LABELS[payment.paymentType] ?? payment.paymentType}
              </td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
              <td className="py-2" style={{ color: BRAND_COLORS.borderDivider }}>Mode</td>
              <td className="py-2 text-right font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                {MODE_LABELS[payment.mode] ?? payment.mode}
              </td>
            </tr>
            {payment.transactionRef && (
              <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                <td className="py-2" style={{ color: BRAND_COLORS.borderDivider }}>Reference</td>
                <td className="py-2 text-right font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                  {payment.transactionRef}
                </td>
              </tr>
            )}
            {payment.estimate && (
              <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                <td className="py-2" style={{ color: BRAND_COLORS.borderDivider }}>Estimate</td>
                <td className="py-2 text-right font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                  {payment.estimate.estimateNo}
                </td>
              </tr>
            )}
            {payment.visit && (
              <tr style={{ borderBottom: `1px solid ${BRAND_COLORS.lightBackground}` }}>
                <td className="py-2" style={{ color: BRAND_COLORS.borderDivider }}>Visit</td>
                <td className="py-2 text-right font-medium" style={{ color: BRAND_COLORS.bodyText }}>
                  {payment.visit.visitNo}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Amount */}
        <div
          className="flex items-center justify-between p-4 rounded-lg"
          style={{ backgroundColor: `${BRAND_COLORS.primaryTeal}10`, border: `2px solid ${BRAND_COLORS.primaryTeal}` }}
        >
          <span className="text-base font-bold" style={{ color: BRAND_COLORS.bodyText }}>
            AMOUNT RECEIVED
          </span>
          <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.primaryTeal }}>
            {formatCurrency(amount)}
          </span>
        </div>

        {payment.notes && (
          <div className="mt-3 text-sm" style={{ color: BRAND_COLORS.borderDivider }}>
            Note: {payment.notes}
          </div>
        )}

        {/* Signature */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
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
        <div className="mt-6">
          <img src="/fotter-1.jpg" alt="Footer" className="w-full" />
        </div>

        <p className="text-center text-xs mt-2" style={{ color: BRAND_COLORS.borderDivider }}>
          This is a computer-generated receipt and does not require a signature.
        </p>
      </div>
    </>
  )
}
