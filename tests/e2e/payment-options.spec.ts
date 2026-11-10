import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { queueService } from "@/server/services/queue.service"
import { estimateService } from "@/server/services/estimate.service"

/**
 * Payment Options on the consultation wizard (Step 3): the instalment box is
 * labelled, wrong input ("3 Installments") gets a clear error, and 34/33/33
 * splits the quote. Seeds its own patient + estimate in the LOCAL database.
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const stamp = Date.now().toString().slice(-6)
let visitId = ""

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  const doctor = await prisma.user.findFirstOrThrow({ where: { email: "dr.jashwant@toothfully.in" } })
  const reception = await prisma.user.findFirstOrThrow({ where: { email: "reception.outram@toothfully.in" } })
  const pt = await patientService.createWithHistory(
    { registrationBranchId: OUTRAM, fullName: `E2E PayOpt ${stamp}`, dateOfBirth: "1985-01-01", gender: "FEMALE", mobile: `93${stamp}01`, email: `payopt${stamp}@example.com`, address: "E2E", leadSource: "", referenceName: "", reasonForVisit: "" } as any,
    { consentGiven: true } as any,
    reception.id
  )
  const { visit } = await queueService.addToQueue({ patientId: pt.id, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "E2E", doctorId: doctor.id }, reception.id)
  visitId = visit.id
  await estimateService.create(
    { patientId: pt.id, branchId: OUTRAM, visitId, items: [{ treatmentName: "Implant", category: "IMPLANTS", quantity: 1, unitRate: 507000, unitRateMax: 529000, sortOrder: 0 }] } as any,
    doctor.id
  )
})

test.afterAll(async () => { await prisma.$disconnect() })

test("instalment box is labelled, rejects '3 Installments', accepts 34/33/33", async ({ page }) => {
  await page.goto(`/doctor/consultation/${visitId}`)
  await page.getByRole("button", { name: /Payment Plan/ }).click()
  await expect(page.getByText("Payment Options").first()).toBeVisible()

  await page.getByRole("button", { name: /Add option/ }).click()
  const title = page.getByLabel("Option title").last()
  await title.fill("Pay as you go")
  const split = page.getByLabel(/Instalments %/).last()
  await expect(split).toBeVisible() // permanent label, not just a placeholder
  await split.fill("3 Installments")
  await page.getByRole("button", { name: /Save & Complete/ }).click()
  await expect(page.getByText(/34\/33\/33 for 3 instalments/)).toBeVisible()

  await split.fill("34/33/33")
  await expect(page.getByText(/34%: /).last()).toBeVisible()
})
