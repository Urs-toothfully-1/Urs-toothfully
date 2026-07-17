"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/** Saves or clears the logged-in doctor's digital signature (base64 data URL). */
export async function updateDoctorSignatureAction(
  dataUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(["DOCTOR"]).catch(() => null)
  if (!session) return { success: false, error: "Only doctors can set a signature." }

  if (dataUrl) {
    if (!dataUrl.startsWith("data:image/")) return { success: false, error: "Please upload a PNG or JPG image." }
    if (dataUrl.length > 500_000) return { success: false, error: "Signature image is too large (keep it under ~350 KB)." }
  }

  try {
    await prisma.user.update({ where: { id: session.userId }, data: { signatureData: dataUrl } })
    revalidatePath("/doctor/signature")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save signature." }
  }
}
