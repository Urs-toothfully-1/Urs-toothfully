import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import type { Browser } from "puppeteer-core"
import { prisma } from "@/lib/prisma"

export type DocumentType = "estimate" | "receipt" | "prescription"

// On Vercel the filesystem is read-only outside /tmp. Locally, keep the
// original path so generated files aren't inside public/.
const IS_VERCEL = !!process.env.VERCEL
const OUTPUT_DIR = IS_VERCEL
  ? "/tmp/generated-documents"
  : path.join(process.cwd(), "generated-documents")

// Local (Windows/Mac dev) browser locations, checked in order. Overridable
// via PUPPETEER_EXECUTABLE_PATH.
const LOCAL_BROWSER_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter((p): p is string => !!p)

let browserPromise: Promise<Browser> | null = null

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default
  if (IS_VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  const executablePath = LOCAL_BROWSER_PATHS.find((p) => existsSync(p))
  if (!executablePath) {
    throw new Error(
      "No local Chrome/Edge found for PDF generation. " +
      "Set PUPPETEER_EXECUTABLE_PATH to a Chrome executable."
    )
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser()
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
