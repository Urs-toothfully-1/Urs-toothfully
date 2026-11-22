"use server"

import { revalidatePath } from "next/cache"
import { ZodError } from "zod"
import { gate, requireRole } from "@/lib/auth"
import { whatsappGroupService } from "@/server/services/whatsapp/group.service"

/** Admin + reception (with WhatsApp access) manage groups; only admin deletes one. */
const staff = () =>
  requireRole(["ADMIN", "RECEPTIONIST"])
    .then(gate("whatsapp"))
    .catch(() => null)
const msg = (e: unknown, fallback: string) =>
  e instanceof ZodError
    ? (e.issues[0]?.message ?? fallback)
    : e instanceof Error
      ? e.message
      : fallback
const refresh = (id?: string) => {
  revalidatePath("/whatsapp/groups")
  if (id) revalidatePath(`/whatsapp/groups/${id}`)
}

export async function createGroupAction(input: { name: string; description?: string }) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  try {
    const g = await whatsappGroupService.create(input, session.userId)
    refresh()
    return { success: true as const, id: g.id }
  } catch (e) {
    return { error: msg(e, "Could not create the group.") }
  }
}

export async function updateGroupAction(id: string, input: { name: string; description?: string }) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  try {
    await whatsappGroupService.update(id, input, session.userId)
    refresh(id)
    return { success: true as const }
  } catch (e) {
    return { error: msg(e, "Could not save.") }
  }
}

export async function deleteGroupAction(id: string) {
  const session = await requireRole(["ADMIN"]).catch(() => null)
  if (!session) return { error: "Only an administrator can delete a group." }
  try {
    await whatsappGroupService.remove(id, session.userId)
    refresh()
    return { success: true as const }
  } catch (e) {
    return { error: msg(e, "Could not delete.") }
  }
}

export async function addGroupMembersAction(id: string, patientIds: string[]) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  try {
    const res = await whatsappGroupService.addMembers(id, patientIds, session.userId)
    refresh(id)
    return { success: true as const, ...res }
  } catch (e) {
    return { error: msg(e, "Could not add.") }
  }
}

export async function addGroupMembersByCodesAction(id: string, text: string) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  try {
    const res = await whatsappGroupService.addByCodes(id, text, session.userId)
    refresh(id)
    return { success: true as const, ...res }
  } catch (e) {
    return { error: msg(e, "Could not add.") }
  }
}

/** Upload a .csv / .xlsx of mobiles or patient IDs → every matching patient joins the group. */
export async function importGroupMembersFileAction(id: string, form: FormData) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  const file = form.get("file")
  if (!(file instanceof File) || !file.size) return { error: "Choose a file." }
  if (file.size > 3.5 * 1024 * 1024) return { error: "File is too large (max 3.5 MB)." } // server-action body cap is 4 MB
  if (!/\.(csv|txt|xlsx)$/i.test(file.name)) return { error: "Use a .csv or .xlsx file." }
  try {
    const codes = await whatsappGroupService.codesFromFile(file)
    if (!codes) return { error: "No mobile numbers or patient IDs found in the file." }
    const res = await whatsappGroupService.addByCodes(id, codes, session.userId)
    refresh(id)
    return { success: true as const, ...res }
  } catch (e) {
    return { error: msg(e, "Could not read the file.") }
  }
}

export async function removeGroupMemberAction(id: string, patientId: string) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  await whatsappGroupService.removeMember(id, patientId)
  refresh(id)
  return { success: true as const }
}

export async function sendGroupMessageAction(id: string, templateId: string, variables: string[]) {
  const session = await staff()
  if (!session) return { error: "Unauthorized" }
  try {
    const res = await whatsappGroupService.send({
      groupId: id,
      templateId,
      variables,
      branchId: session.branchId,
      userId: session.userId,
    })
    refresh(id)
    return { success: true as const, ...res }
  } catch (e) {
    return { error: msg(e, "Could not send.") }
  }
}
