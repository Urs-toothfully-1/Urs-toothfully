"use server"

import { z } from "zod"
import { getSession } from "@/lib/auth"
import { paymentAgreementService } from "@/server/services/payment-agreement.service"
import { PaymentStage } from "@/lib/payment-agreement"

const stageSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().min(0),
  dueDate: z.string().max(10).default(""),
  received: z.boolean().default(false),
})

const saveSchema = z.object({
  estimateId: z.string().uuid(),
  stages: z.array(stageSchema).min(1).max(10),
  clinicRepresentative: z.string().max(200).optional().nullable(),
  termsAccepted: z.boolean().default(false),
  patientSignedAt: z.string().optional().nullable(), // ISO string or null
})

export type SavePaymentAgreementState = {
  success?: boolean
  error?: string
}

export async function savePaymentAgreementAction(
  _prev: SavePaymentAgreementState,
  formData: FormData
): Promise<SavePaymentAgreementState> {
  const session = await getSession()
  if (!session || !["ADMIN", "RECEPTIONIST", "DOCTOR"].includes(session.role)) {
    return { error: "Unauthorised" }
  }

  let parsed: z.infer<typeof saveSchema>
  try {
    const raw = JSON.parse(formData.get("payload") as string)
    parsed = saveSchema.parse(raw)
  } catch {
    return { error: "Invalid data" }
  }

  try {
    await paymentAgreementService.save(
      parsed.estimateId,
      parsed.stages as PaymentStage[],
      parsed.clinicRepresentative ?? null,
      parsed.termsAccepted,
      parsed.patientSignedAt ? new Date(parsed.patientSignedAt) : null
    )
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed" }
  }
}
