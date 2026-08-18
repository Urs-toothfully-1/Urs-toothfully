"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"

export type TemplateResult = { success: boolean; error?: string }

const SECTIONS = ["DIAGNOSIS", "COMPLAINT"] as const

// ── Clinical phrases (diagnosis / examination / chief complaint) ──────────

const phraseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  specialty: z.string().trim().min(1, "Group is required").max(100),
  section: z.enum(SECTIONS),
})

export async function savePhraseAction(input: unknown, id?: string): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  const parsed = phraseSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the entries." }
  }
  const { name, specialty, section } = parsed.data

  try {
    // Wording is unique per section within a branch — report the clash rather
    // than letting the raw constraint error surface.
    const clash = await prisma.diagnosis.findUnique({
      where: { branchId_section_name: { branchId: session.branchId, section, name } },
      select: { id: true },
    })
    if (clash && clash.id !== id) {
      return { success: false, error: `"${name}" is already in this list.` }
    }

    if (id) {
      const existing = await prisma.diagnosis.findUnique({
        where: { id },
        select: { branchId: true },
      })
      if (!existing || existing.branchId !== session.branchId) {
        return { success: false, error: "Entry not found." }
      }
      await prisma.diagnosis.update({ where: { id }, data: { name, specialty } })
    } else {
      await prisma.diagnosis.create({
        data: {
          branchId: session.branchId,
          name,
          specialty,
          section,
          isStandard: false,
          createdBy: session.userId,
        },
      })
    }

    await createAuditLog({
      entityType: "Diagnosis",
      entityId: id ?? name,
      action: id ? "UPDATE" : "CREATE",
      changedById: session.userId,
      newValues: { name, specialty, section },
      branchId: session.branchId,
    })

    revalidatePath("/templates", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not save." }
  }
}

/**
 * Archives rather than deletes: prescriptions store their own copy of the text,
 * but an entry may still be referenced by usage history, and archiving is
 * reversible if it turns out to be in use.
 */
export async function setPhraseActiveAction(id: string, isActive: boolean): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  try {
    const existing = await prisma.diagnosis.findUnique({ where: { id }, select: { branchId: true } })
    if (!existing || existing.branchId !== session.branchId) {
      return { success: false, error: "Entry not found." }
    }
    await prisma.diagnosis.update({ where: { id }, data: { isActive } })

    await createAuditLog({
      entityType: "Diagnosis",
      entityId: id,
      action: "UPDATE",
      changedById: session.userId,
      newValues: { isActive },
      branchId: session.branchId,
    })

    revalidatePath("/templates", "page")
    return { success: true }
  } catch {
    return { success: false, error: "Could not update." }
  }
}

// ── Medicines ────────────────────────────────────────────────────────────

const medicineSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  category: z.string().trim().min(1, "Category is required").max(100),
})

export async function saveMedicineAction(input: unknown, id?: string): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  const parsed = medicineSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the entries." }
  }
  const { name, category } = parsed.data

  try {
    const clash = await prisma.medicine.findUnique({
      where: { branchId_name: { branchId: session.branchId, name } },
      select: { id: true },
    })
    if (clash && clash.id !== id) {
      return { success: false, error: `"${name}" is already in the list.` }
    }

    if (id) {
      const existing = await prisma.medicine.findUnique({ where: { id }, select: { branchId: true } })
      if (!existing || existing.branchId !== session.branchId) {
        return { success: false, error: "Medicine not found." }
      }
      await prisma.medicine.update({ where: { id }, data: { name, category } })
    } else {
      await prisma.medicine.create({ data: { branchId: session.branchId, name, category } })
    }

    await createAuditLog({
      entityType: "Medicine",
      entityId: id ?? name,
      action: id ? "UPDATE" : "CREATE",
      changedById: session.userId,
      newValues: { name, category },
      branchId: session.branchId,
    })

    revalidatePath("/templates", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not save." }
  }
}

export async function setMedicineActiveAction(id: string, isActive: boolean): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  try {
    const existing = await prisma.medicine.findUnique({ where: { id }, select: { branchId: true } })
    if (!existing || existing.branchId !== session.branchId) {
      return { success: false, error: "Medicine not found." }
    }
    await prisma.medicine.update({ where: { id }, data: { isActive } })
    revalidatePath("/templates", "page")
    return { success: true }
  } catch {
    return { success: false, error: "Could not update." }
  }
}

// ── Medicine protocols (multi-drug templates) ────────────────────────────

const protocolSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        medicine: z.string().trim().min(1, "Medicine is required").max(300),
        frequency: z.string().trim().max(20).default(""),
        duration: z.string().trim().max(50).default(""),
      })
    )
    .min(1, "Add at least one medicine")
    .max(20),
})

export async function saveProtocolAction(input: unknown, id?: string): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  const parsed = protocolSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the entries." }
  }
  const { name, description, items } = parsed.data

  // One row per medicine is enforced by the schema; collapse repeats up front so
  // a duplicated line cannot fail the whole save.
  const seen = new Set<string>()
  const unique = items.filter((i) => {
    const key = i.medicine.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  try {
    const clash = await prisma.medicineTemplate.findUnique({
      where: { branchId_name: { branchId: session.branchId, name } },
      select: { id: true },
    })
    if (clash && clash.id !== id) {
      return { success: false, error: `A protocol called "${name}" already exists.` }
    }

    if (id) {
      const existing = await prisma.medicineTemplate.findUnique({
        where: { id },
        select: { branchId: true },
      })
      if (!existing || existing.branchId !== session.branchId) {
        return { success: false, error: "Protocol not found." }
      }
      // Items are replaced wholesale — simpler and safer than diffing rows.
      await prisma.$transaction([
        prisma.medicineTemplateItem.deleteMany({ where: { templateId: id } }),
        prisma.medicineTemplate.update({
          where: { id },
          data: {
            name,
            description: description || null,
            items: {
              create: unique.map((i, idx) => ({
                medicine: i.medicine,
                frequency: i.frequency,
                duration: i.duration,
                sortOrder: idx,
              })),
            },
          },
        }),
      ])
    } else {
      await prisma.medicineTemplate.create({
        data: {
          branchId: session.branchId,
          name,
          description: description || null,
          createdBy: session.userId,
          items: {
            create: unique.map((i, idx) => ({
              medicine: i.medicine,
              frequency: i.frequency,
              duration: i.duration,
              sortOrder: idx,
            })),
          },
        },
      })
    }

    await createAuditLog({
      entityType: "MedicineTemplate",
      entityId: id ?? name,
      action: id ? "UPDATE" : "CREATE",
      changedById: session.userId,
      newValues: { name, items: unique.length },
      branchId: session.branchId,
    })

    revalidatePath("/templates", "page")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not save." }
  }
}

export async function deleteProtocolAction(id: string): Promise<TemplateResult> {
  const session = await requireRole(["ADMIN", "DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Not allowed." }

  try {
    const existing = await prisma.medicineTemplate.findUnique({
      where: { id },
      select: { branchId: true, name: true },
    })
    if (!existing || existing.branchId !== session.branchId) {
      return { success: false, error: "Protocol not found." }
    }
    // Items cascade with the template; nothing else references it.
    await prisma.medicineTemplate.delete({ where: { id } })

    await createAuditLog({
      entityType: "MedicineTemplate",
      entityId: id,
      action: "DELETE",
      changedById: session.userId,
      previousValues: { name: existing.name },
      branchId: session.branchId,
    })

    revalidatePath("/templates", "page")
    return { success: true }
  } catch {
    return { success: false, error: "Could not delete." }
  }
}
