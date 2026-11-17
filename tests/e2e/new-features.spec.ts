import { test, expect, type Page } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { directVisitService } from "@/server/services/direct-visit.service"
import { paymentService } from "@/server/services/payment.service"

/**
 * Nov-17 features, against the LOCAL database:
 *  1. WhatsApp groups — create, add (search + paste), send a template, log
 *  2. Potential clients — enquiry / last message / follow-up, double-click edit, popup, filters
 *  3. Prescription from the patient profile (no queue) — who created it, cancel
 *  4. WhatsApp inbox on a phone — list → chat → back
 * Nothing is really sent: there are no WhatsApp credentials locally, and every
 * queued test message is cancelled afterwards.
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const stamp = Date.now().toString().slice(-6)
const ids = { withConsent: "", noConsent: "", direct: "", paid: "", lead: "", inboxPhone: `9192${stamp}01` }
const names = { withConsent: `E2E Grp Yes ${stamp}`, noConsent: `E2E Grp No ${stamp}`, direct: `E2E Direct ${stamp}`, lead: `E2E Lead ${stamp}` }
const codes = { noConsent: "" }
let template: { id: string; status: string; isEnabled: boolean } | null = null
let savedSending: boolean | null = null

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  const reception = await prisma.user.findFirstOrThrow({ where: { email: "reception.outram@toothfully.in" } })
  const mk = async (fullName: string, mobile: string, consent: boolean) => {
    const p = await patientService.createWithHistory(
      { registrationBranchId: OUTRAM, fullName, dateOfBirth: "1990-01-01", gender: "FEMALE", mobile, email: `nf${mobile}@example.com`, address: "E2E", leadSource: "", referenceName: "", reasonForVisit: "" } as any,
      { consentGiven: true } as any,
      reception.id
    )
    await prisma.whatsAppConsent.upsert({
      where: { patientId: p.id },
      create: { patientId: p.id, consented: consent, consentAt: new Date() },
      update: { consented: consent, revokedAt: null },
    })
    return p
  }
  ids.withConsent = (await mk(names.withConsent, `92${stamp}01`, true)).id
  const nc = await mk(names.noConsent, `92${stamp}02`, false)
  ids.noConsent = nc.id
  codes.noConsent = nc.patientId
  ids.direct = (await mk(names.direct, `92${stamp}03`, false)).id
  ids.paid = (await mk(`E2E Paid ${stamp}`, `92${stamp}04`, false)).id

  // One approved template to send (restored afterwards).
  const t = await prisma.whatsAppTemplate.findFirstOrThrow({ where: { name: "visit_feedback" }, select: { id: true, status: true, isEnabled: true } })
  template = t
  await prisma.whatsAppTemplate.update({ where: { id: t.id }, data: { status: "APPROVED", isEnabled: true } })
  const settings = await prisma.whatsAppSettings.findFirst()
  if (settings) {
    savedSending = settings.sendingEnabled
    await prisma.whatsAppSettings.update({ where: { id: settings.id }, data: { sendingEnabled: true } })
  }

  ids.lead = (await prisma.potentialClient.create({
    data: { fullName: names.lead, mobile: `93${stamp}55`, source: "E2E", createdById: reception.id },
  })).id

  // A small inbound conversation for the inbox test.
  await prisma.whatsAppInbound.createMany({
    data: [
      { direction: "IN", fromPhone: ids.inboxPhone, text: `Hello from E2E ${stamp}`, needsStaff: true, botAction: "HANDOFF" },
      { direction: "OUT", fromPhone: ids.inboxPhone, text: "Thanks, our team will reply", botAction: "BOT_REPLY" },
    ],
  })
})

test.afterAll(async () => {
  await prisma.whatsAppMessage.updateMany({
    where: { patientId: { in: [ids.withConsent, ids.noConsent] }, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })
  if (template) await prisma.whatsAppTemplate.update({ where: { id: template.id }, data: { status: template.status as any, isEnabled: template.isEnabled } })
  if (savedSending !== null) await prisma.whatsAppSettings.updateMany({ data: { sendingEnabled: savedSending } })
  await prisma.$disconnect()
})

const acceptDialogs = (page: Page) => page.on("dialog", (d) => d.accept())

test.describe("1. WhatsApp groups (reception)", () => {
  test.use({ storageState: "tests/e2e/.auth/reception.json" })
  const groupName = `E2E Group ${stamp}`

  test("create a group, add patients by search and by paste", async ({ page }) => {
    await page.goto("/whatsapp/groups")
    await expect(page.getByRole("link", { name: "Groups" })).toBeVisible()
    await page.getByPlaceholder(/Implant patients/).fill(groupName)
    await page.getByRole("button", { name: /Create group/ }).click()
    await expect(page).toHaveURL(/\/whatsapp\/groups\/[0-9a-f-]+$/)
    await expect(page.getByRole("heading", { name: groupName })).toBeVisible()

    await page.getByLabel("Search patients to add").fill(names.withConsent)
    await page.getByRole("button", { name: "Add", exact: true }).first().click()
    await expect(page.getByText(names.withConsent).first()).toBeVisible()

    await page.getByLabel("Paste mobiles or patient IDs").fill(`${codes.noConsent}\n0000000000`)
    await page.getByRole("button", { name: "Add to group" }).click()
    await expect(page.getByText(/Not found: 0000000000/)).toBeVisible()
    await expect(page.getByText(names.noConsent).first()).toBeVisible()
    await expect(page.getByText("No consent").first()).toBeVisible()
  })

  test("send a template: consented patient queued, the other skipped, log shows it", async ({ page }) => {
    acceptDialogs(page)
    const group = await prisma.whatsAppGroup.findUniqueOrThrow({ where: { name: groupName } })
    await page.goto(`/whatsapp/groups/${group.id}`)
    await page.getByRole("tab", { name: "Send message" }).click()
    await page.getByLabel("Template").selectOption(template!.id)
    await expect(page.getByText(/Goes to\s*1\s*of 2 patients/)).toBeVisible()
    await page.getByRole("button", { name: /Send to group/ }).click()
    await expect(page.getByText(/Queued 1 · 1 skipped/)).toBeVisible()

    await page.getByRole("tab", { name: /Log/ }).click()
    await expect(page.getByRole("cell", { name: names.withConsent })).toBeVisible()
    const msgs = await prisma.whatsAppMessage.findMany({ where: { groupId: group.id } })
    expect(msgs.map((m) => m.patientId)).toEqual([ids.withConsent])
    expect((msgs[0].variables as string[])[0]).toBe("E2E") // {name} → first name
  })

  test("remove a member", async ({ page }) => {
    const group = await prisma.whatsAppGroup.findUniqueOrThrow({ where: { name: groupName } })
    await page.goto(`/whatsapp/groups/${group.id}`, { waitUntil: "networkidle" }) // hydrated before clicking
    await page.getByRole("button", { name: `Remove ${names.noConsent}` }).click()
    await expect(page.getByText(names.noConsent)).toHaveCount(0)
    // The row hides instantly; wait for the save itself.
    await expect.poll(() => prisma.whatsAppGroupMember.count({ where: { groupId: group.id } })).toBe(1)
  })
})

test.describe("2. Potential clients (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" })

  test("double-click edits enquiry and last message", async ({ page }) => {
    await page.goto(`/admin/potential-clients?q=${encodeURIComponent(names.lead)}`)
    await page.getByRole("button", { name: `Enquiry for ${names.lead}` }).dblclick()
    await page.getByRole("combobox", { name: `Enquiry for ${names.lead}` }).fill("Implants") // has a suggestion list
    await page.keyboard.press("Enter")
    await expect(page.getByRole("button", { name: `Enquiry for ${names.lead}` })).toHaveText("Implants")

    await page.getByRole("button", { name: `Last message for ${names.lead}` }).dblclick()
    await page.getByRole("textbox", { name: `Last message for ${names.lead}` }).fill("Asked for implant cost, will visit Saturday")
    await page.keyboard.press("Control+Enter")
    await expect(page.getByText("Asked for implant cost, will visit Saturday")).toBeVisible()

    const lead = await prisma.potentialClient.findUniqueOrThrow({ where: { id: ids.lead } })
    expect(lead.enquiry).toBe("Implants")
    expect(lead.lastMessage).toBe("Asked for implant cost, will visit Saturday")
  })

  test("edit popup sets a follow-up; 'Follow-ups due' finds it", async ({ page }) => {
    await page.goto(`/admin/potential-clients?q=${encodeURIComponent(names.lead)}`)
    await page.getByRole("button", { name: `Edit ${names.lead}` }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Treatment enquiry")).toBeVisible()
    await expect(dialog.getByText("Last message")).toBeVisible()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await dialog.locator('input[type="date"]').fill(yesterday)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Saved")).toBeVisible()

    await page.goto("/admin/potential-clients")
    await page.getByRole("button", { name: /Follow-ups due/ }).click()
    await expect(page).toHaveURL(/due=1/)
    await expect(page.getByText(names.lead)).toBeVisible()
  })

  test("add popup has enquiry and last message fields", async ({ page }) => {
    await page.goto("/admin/potential-clients")
    await page.getByRole("button", { name: /^Add$/ }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByLabel("Treatment enquiry")).toBeVisible()
    await expect(dialog.getByLabel("Last message", { exact: true })).toBeVisible()
  })
})

test.describe("3. Prescription from the patient profile (reception)", () => {
  test.use({ storageState: "tests/e2e/.auth/reception.json" })

  test("start without the queue, finish, and the visit shows who created it", async ({ page }) => {
    const doctor = await prisma.user.findFirstOrThrow({ where: { email: "dr.jashwant@toothfully.in" } })
    await page.goto(`/patients/${ids.direct}`)
    await page.getByRole("button", { name: /New prescription \/ estimate/ }).click()
    await page.getByLabel("Doctor").selectOption({ label: doctor.name })
    await page.getByLabel("Chief complaint").fill("Tooth pain")
    await page.getByRole("button", { name: "Start" }).click()
    await expect(page).toHaveURL(/\/doctor\/consultation\//)
    await expect(page.getByText("Step 1 — Prescription")).toBeVisible()

    await page.getByRole("button", { name: /Finish \(Prescription only\)/ }).click()
    await expect(page).toHaveURL(new RegExp(`/patients/${ids.direct}$`))

    const visit = await prisma.patientVisit.findFirstOrThrow({ where: { patientId: ids.direct }, include: { createdBy: true, queueEntry: true } })
    expect(visit.queueEntry).toBeNull()
    expect(visit.createdBy.email).toBe("reception.outram@toothfully.in")
    expect(visit.status).toBe("COMPLETED")
    expect(await prisma.prescriptionRecord.count({ where: { visitId: visit.id } })).toBe(1)
    expect(await prisma.auditLog.count({ where: { entityType: "PatientVisit", entityId: visit.id } })).toBeGreaterThanOrEqual(2)

    await page.goto(`/patients/${ids.direct}/visits`)
    await expect(page.getByText(new RegExp(`Created by ${visit.createdBy.name}`))).toBeVisible()
    await expect(page.getByText("From profile · no queue")).toBeVisible()
  })

  test("cancel the visit from the profile; it records who cancelled", async ({ page }) => {
    const visit = await prisma.patientVisit.findFirstOrThrow({ where: { patientId: ids.direct } })
    await page.goto(`/patients/${ids.direct}/visits`)
    await page.getByRole("button", { name: `Cancel ${visit.visitNo}` }).click()
    await page.getByLabel("Reason for cancelling").fill("Created by mistake")
    await page.getByRole("button", { name: "Cancel visit" }).click()
    await expect(page.getByText(/Cancelled by .* — Created by mistake/)).toBeVisible()
    const after = await prisma.patientVisit.findUniqueOrThrow({ where: { id: visit.id } })
    expect(after.status).toBe("CANCELLED")
    expect(after.cancelReason).toBe("Created by mistake")
  })

  test("a visit with a payment can't be cancelled", async () => {
    const reception = await prisma.user.findFirstOrThrow({ where: { email: "reception.outram@toothfully.in" } })
    const doctor = await prisma.user.findFirstOrThrow({ where: { email: "dr.jashwant@toothfully.in" } })
    const v = await directVisitService.start({ patientId: ids.paid, doctorId: doctor.id, branchId: OUTRAM, userId: reception.id })
    await paymentService.create({ paymentType: "CONSULTATION", patientId: ids.paid, branchId: OUTRAM, visitId: v.id, amount: 500, mode: "CASH" } as any, reception.id)
    await expect(directVisitService.cancel(v.id, "testing", reception.id)).rejects.toThrow(/payments or invoices/)
  })
})

test.describe("4. WhatsApp inbox on a phone (admin)", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json", viewport: { width: 390, height: 844 }, hasTouch: true })

  test("chat list → open chat → back", async ({ page }) => {
    await page.goto("/whatsapp/inbox")
    await page.getByLabel("Search chats").fill(ids.inboxPhone.slice(-6))
    // Find the chat by its number (the preview text depends on which seeded message is newest).
    const shownPhone = `+91 ${ids.inboxPhone.slice(2, 7)} ${ids.inboxPhone.slice(7)}`
    const chat = page.getByRole("button", { name: shownPhone }) // plain substring match
    await expect(chat).toBeVisible()
    await chat.click()
    await expect(page.getByLabel("Back to chats")).toBeVisible()
    await expect(page.getByText(`Hello from E2E ${stamp}`).last()).toBeVisible()
    await expect(page.getByLabel("Reply")).toBeVisible()
    await expect(page.getByLabel("Search chats")).toBeHidden() // list is hidden while a chat is open
    await page.getByLabel("Back to chats").click()
    await expect(page.getByLabel("Search chats")).toBeVisible()
  })
})
