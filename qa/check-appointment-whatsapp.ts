/**
 * Professional appointment templates (v2) and the switchover:
 *  - v2 templates are seeded with a heading, footer and Call/Website buttons, but
 *    WITHOUT the trigger while the old approved template still holds it;
 *  - sendTrigger sends only as many values as the template has (old cancel = 2);
 *  - once v2 is APPROVED, switchToApprovedVersions hands it the trigger and the
 *    same call now sends all values to v2.
 *
 * LOCAL database only (restores every template it touches):
 *   npx dotenvx run -f .env.local -- npx tsx qa/check-appointment-whatsapp.ts
 */
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { templateService } from "@/server/services/whatsapp/template.service"
import { whatsappService } from "@/server/services/whatsapp/whatsapp.service"
import { countTemplateVariables } from "@/lib/whatsapp/templates"

const OUTRAM = "branch-outram-0000-0000-000000000001"
const stamp = String(Date.now()).slice(-6)
let failed = 0
const check = (label: string, ok: boolean, got?: unknown) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`, ok ? "" : JSON.stringify(got))
  if (!ok) failed++
}

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
  await templateService.ensureDefaults(admin.id)

  const v2s = await prisma.whatsAppTemplate.findMany({
    where: { name: { in: ["appointment_confirmed_v2", "appointment_reminder_v2", "appointment_cancelled_v2"] } },
  })
  check("3 professional templates seeded", v2s.length === 3, v2s.map((t) => t.name))
  for (const t of v2s) {
    const buttons = (t.buttons as { type: string; phone_number?: string; url?: string }[] | null) ?? []
    check(
      `${t.name}: heading, footer, Call + Website buttons`,
      t.headerType === "TEXT" && !!t.headerText && !!t.footerText &&
        buttons.some((b) => b.type === "PHONE_NUMBER" && b.phone_number) && buttons.some((b) => b.type === "URL" && b.url),
      t
    )
  }

  const oldCancel = await prisma.whatsAppTemplate.findUniqueOrThrow({ where: { name: "appointment_cancelled" } })
  const newCancel = v2s.find((t) => t.name === "appointment_cancelled_v2")!
  const saved = [oldCancel, newCancel].map((t) => ({ id: t.id, status: t.status, isEnabled: t.isEnabled, triggerKey: t.triggerKey }))
  check("old template keeps the trigger until v2 is approved", oldCancel.triggerKey === "APPOINTMENT_CANCELLED" && newCancel.triggerKey === null)
  check("v2 cancel has 3 values, old has 2", countTemplateVariables(newCancel.body) === 3 && countTemplateVariables(oldCancel.body) === 2)

  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", branchId: OUTRAM } })
  const p = await patientService.createWithHistory(
    { registrationBranchId: OUTRAM, fullName: "Tara Template", dateOfBirth: "1990-01-01", gender: "FEMALE", mobile: `94${stamp}31`, email: `tpl${stamp}@example.com`, address: "1 QA Road", leadSource: "", referenceName: "", reasonForVisit: "" } as any,
    { consentGiven: true } as any,
    reception.id
  )
  await prisma.whatsAppConsent.upsert({ where: { patientId: p.id }, create: { patientId: p.id, consented: true, consentAt: new Date() }, update: { consented: true, revokedAt: null } })
  const values = ["Tara", "26 Nov 2026 at 11:00 AM", "Outram"]
  const send = () => whatsappService.sendTrigger({ triggerKey: "APPOINTMENT_CANCELLED", patientId: p.id, variables: values, skipConsultationGate: true })
  const last = () => prisma.whatsAppMessage.findFirst({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, select: { templateName: true, variables: true } })

  try {
    await prisma.whatsAppTemplate.update({ where: { id: oldCancel.id }, data: { isEnabled: true } })
    await send()
    let m = await last()
    check("old template gets only its 2 values (Meta would reject 3)", m?.templateName === "appointment_cancelled" && (m.variables as string[]).length === 2, m)

    await prisma.whatsAppTemplate.update({ where: { id: newCancel.id }, data: { status: "APPROVED", isEnabled: true } })
    const moved = await templateService.switchToApprovedVersions()
    const [o, n] = await Promise.all([
      prisma.whatsAppTemplate.findUniqueOrThrow({ where: { id: oldCancel.id } }),
      prisma.whatsAppTemplate.findUniqueOrThrow({ where: { id: newCancel.id } }),
    ])
    check("approved v2 takes over the trigger", moved >= 1 && n.triggerKey === "APPOINTMENT_CANCELLED" && o.triggerKey === null, { moved, o: o.triggerKey, n: n.triggerKey })
    await send()
    m = await last()
    check("after switchover the same call sends all 3 values to v2", m?.templateName === "appointment_cancelled_v2" && (m.variables as string[]).length === 3, m)
    check("running the switch again changes nothing", (await templateService.switchToApprovedVersions()) === 0)
  } finally {
    // Put both templates back exactly as they were.
    await prisma.whatsAppTemplate.updateMany({ where: { id: { in: saved.map((s) => s.id) } }, data: { triggerKey: null } })
    for (const s of saved) await prisma.whatsAppTemplate.update({ where: { id: s.id }, data: { status: s.status, isEnabled: s.isEnabled, triggerKey: s.triggerKey } })
    await prisma.whatsAppMessage.updateMany({ where: { patientId: p.id }, data: { status: "CANCELLED", cancelledAt: new Date() } })
  }

  console.log(failed ? `\n${failed} failed` : "\nall passed")
  await prisma.$disconnect()
  process.exit(failed ? 1 : 0)
}
main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
