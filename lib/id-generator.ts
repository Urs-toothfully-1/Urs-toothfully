import { prisma } from "@/lib/prisma"
import { ID_PREFIXES } from "@/lib/constants"

async function getNextSequence(year: number, prefix: string): Promise<number> {
  // Each entity type uses its own table to get current max ID
  // This is a helper — callers pass the current max from their specific table
  return 1
}

export function formatId(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, "0")}`
}

export async function generatePatientId(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.patient.findFirst({
    where: { patientId: { startsWith: `PAT-${year}-` } },
    orderBy: { patientId: "desc" },
    select: { patientId: true },
  })
  const next = latest ? parseInt(latest.patientId.split("-")[2]) + 1 : 1
  return formatId(ID_PREFIXES.patient, year, next)
}

export async function generateVisitNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.patientVisit.findFirst({
    where: { visitNo: { startsWith: `VISIT-${year}-` } },
    orderBy: { visitNo: "desc" },
    select: { visitNo: true },
  })
  const next = latest ? parseInt(latest.visitNo.split("-")[2]) + 1 : 1
  return formatId(ID_PREFIXES.visit, year, next)
}

export async function generateEstimateNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.estimate.findFirst({
    where: { estimateNo: { startsWith: `EST-${year}-` } },
    orderBy: { estimateNo: "desc" },
    select: { estimateNo: true },
  })
  const next = latest ? parseInt(latest.estimateNo.split("-")[2]) + 1 : 1
  return formatId(ID_PREFIXES.estimate, year, next)
}

export async function generateReceiptNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.receipt.findFirst({
    where: { receiptNo: { startsWith: `RCP-${year}-` } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  })
  const next = latest ? parseInt(latest.receiptNo.split("-")[2]) + 1 : 1
  return formatId(ID_PREFIXES.receipt, year, next)
}

export async function generateExportBatchNo(): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await prisma.exportBatch.findFirst({
    where: { batchNo: { startsWith: `EXP-${year}-` } },
    orderBy: { batchNo: "desc" },
    select: { batchNo: true },
  })
  const next = latest ? parseInt(latest.batchNo.split("-")[2]) + 1 : 1
  return formatId(ID_PREFIXES.exportBatch, year, next)
}
