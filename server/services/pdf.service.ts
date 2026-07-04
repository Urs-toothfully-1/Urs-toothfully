import path from "path"
import fs from "fs/promises"
import type { Browser } from "puppeteer"
import { prisma } from "@/lib/prisma"

export type DocumentType = "estimate" | "receipt" | "prescription"

// PDFs are written outside public/ so they are only reachable through the
// auth-checked API route.
const OUTPUT_DIR = path.join(process.cwd(), "generated-documents")

let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import("puppeteer").then((puppeteer) =>
      puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
    )
    browserPromise.catch(() => { browserPromise = null })
  }
  return browserPromise
}

export interface GeneratedPdf {
  buffer: Buffer
  fileName: string
  filePath: string
}

/**
 * Renders the app's own /print/<type>/<id> route to an A4 PDF, reusing the
 * caller's session cookie so the print route's auth check passes. Records a
 * GeneratedDocument row for audit/tracking.
 */
export async function generateDocumentPdf(opts: {
  type: DocumentType
  /** estimate id, receipt id, or prescription-record id */
  id: string
  /** e.g. http://192.168.1.5:3000 — derived from the incoming request */
  baseUrl: string
  /** raw Cookie header from the incoming request */
  cookieHeader: string
  generatedById: string
}): Promise<GeneratedPdf> {
  const { type, id, baseUrl, cookieHeader, generatedById } = opts

  // Resolve document metadata + the print-route URL
  let printPath: string
  let docNo: string
  let patientId: string
  let linkIds: { estimateId?: string; receiptId?: string; prescriptionId?: string } = {}

  if (type === "estimate") {
    const est = await prisma.estimate.findUnique({
      where: { id, isDeleted: false },
      select: { id: true, estimateNo: true, patientId: true },
    })
    if (!est) throw new Error("Estimate not found")
    printPath = `/print/estimate/${est.id}`
    docNo = est.estimateNo
    patientId = est.patientId
    linkIds = { estimateId: est.id }
  } else if (type === "receipt") {
    const rcp = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, receiptNo: true, patientId: true },
    })
    if (!rcp) throw new Error("Receipt not found")
    printPath = `/print/receipt/${rcp.id}`
    docNo = rcp.receiptNo
    patientId = rcp.patientId
    linkIds = { receiptId: rcp.id }
  } else {
    const rx = await prisma.prescriptionRecord.findUnique({
      where: { id },
      select: { id: true, visitId: true, patientId: true, patient: { select: { patientId: true } } },
    })
    if (!rx) throw new Error("Prescription not found")
    printPath = `/print/prescription/${rx.visitId}`
    docNo = `RX-${rx.patient.patientId}`
    patientId = rx.patientId
    linkIds = { prescriptionId: rx.id }
  }

  const browser = await getBrowser()
  const page = await browser.newPage()
  let buffer: Buffer
  try {
    await page.setExtraHTTPHeaders({ cookie: cookieHeader })
    await page.goto(`${baseUrl}${printPath}`, { waitUntil: "networkidle0", timeout: 30000 })
    const margin = type === "prescription" ? "6mm" : "8mm"
    buffer = Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: margin, bottom: margin, left: margin, right: margin },
      })
    )
  } finally {
    await page.close().catch(() => {})
  }

  const fileName = `${type === "prescription" ? "Prescription" : type === "receipt" ? "Receipt" : "Estimate"}-${docNo}.pdf`
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const filePath = path.join(OUTPUT_DIR, `${type}-${id}.pdf`)
  await fs.writeFile(filePath, buffer)

  // One tracking row per document — refresh it on regeneration
  const existing = await prisma.generatedDocument.findFirst({
    where: { documentType: type, ...linkIds },
    select: { id: true },
  })
  if (existing) {
    await prisma.generatedDocument.update({
      where: { id: existing.id },
      data: { generatedById, generatedAt: new Date(), filePath, fileSize: buffer.length },
    })
  } else {
    await prisma.generatedDocument.create({
      data: {
        documentType: type,
        patientId,
        ...linkIds,
        generatedById,
        filePath,
        fileSize: buffer.length,
        mimeType: "application/pdf",
      },
    })
  }

  return { buffer, fileName, filePath }
}
