"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import type { LeadStatus } from "@prisma/client"
import { requireRole } from "@/lib/auth"
import { potentialClientService } from "@/server/services/potential-client.service"

const PATH = "/admin/potential-clients"
const err = (e: unknown, fallback: string) =>
  e instanceof ZodError ? e.issues[0]?.message ?? fallback : e instanceof Error ? e.message : fallback

async function admin() {
  return requireRole(["ADMIN"]).catch(() => null)
}

export async function importPotentialClientsAction(rows: unknown[], optIn: boolean, source?: string) {
  const session = await admin()
  if (!session) return { error: "Only an administrator can import." }
  try {
    const result = await potentialClientService.importRows(rows, optIn, source?.trim() || undefined, session.userId)
    revalidatePath(PATH)
    return { success: true as const, ...result }
  } catch (e) {
    return { error: err(e, "Import failed.") }
  }
}

export async function addPotentialClientAction(input: unknown, optIn: boolean) {
  const session = await admin()
  if (!session) return { error: "Unauthorized" }
  try {
    await potentialClientService.add(input, optIn, session.userId)
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: err(e, "Could not add.") }
  }
}

export async function updatePotentialClientAction(id: string, data: { status?: LeadStatus; whatsappOptIn?: boolean }) {
  const session = await admin()
  if (!session) return { error: "Unauthorized" }
  try {
    await potentialClientService.update(id, data)
    revalidatePath(PATH)
    return { success: true }
  } catch (e) {
    return { error: err(e, "Could not update.") }
  }
}

export async function deletePotentialClientsAction(ids: string[]) {
  const session = await admin()
  if (!session) return { error: "Unauthorized" }
  try {
    const count = await potentialClientService.remove(ids, session.userId)
    revalidatePath(PATH)
    return { success: true, count }
  } catch (e) {
    return { error: err(e, "Could not delete.") }
  }
}

export async function sendPotentialClientsWhatsAppAction(ids: string[], templateId: string, variables: string[]) {
  const session = await admin()
  if (!session) return { error: "Unauthorized" }
  try {
    const result = await potentialClientService.sendWhatsApp({ ids, templateId, variables, branchId: session.branchId, userId: session.userId })
    revalidatePath(PATH)
    return { success: true as const, ...result }
  } catch (e) {
    return { error: err(e, "Could not send.") }
  }
}
