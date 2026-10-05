import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { queueService } from "@/server/services/queue.service"
import { estimateService } from "@/server/services/estimate.service"
import { paymentService } from "@/server/services/payment.service"
import { referralService } from "@/server/services/referral.service"

/**
 * Quote → treatment invoice flow, referral program, and cross-branch
 * appointments, through the UI. Seeds its own patients directly in the DB, so
 * run with the app's DATABASE_URL in the environment:
 *   npx dotenvx run -f .env.local -- npx playwright test invoice-referral
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const ALIPORE = "branch-alipo-0000-0000-000000000002"
const stamp = Date.now().toString().slice(-6)
const ids = { referrer: "", friend: "", referrerName: `E2E Referrer ${stamp}`, friendName: `E2E Friend ${stamp}`, referrerMobile: `96${stamp}01` }

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  const doctor = await prisma.user.findFirstOrThrow({ where: { email: "dr.jashwant@toothfully.in" } })
  const reception = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST", branchId: OUTRAM } })
  const mk = (fullName: string, mobile: string) =>
    patientService.createWithHistory(
      { registrationBranchId: OUTRAM, fullName, dateOfBirth: "1990-01-01", gender: "FEMALE", mobile, email: `e2e${mobile}@example.com`, address: "E2E", leadSource: "", referenceName: "", reasonForVisit: "" } as any,
      { consentGiven: true } as any,
      reception.id
    )
  const referrer = await mk(ids.referrerName, ids.referrerMobile)
  const friend = await mk(ids.friendName, `96${stamp}02`)
  ids.referrer = referrer.id
  ids.friend = friend.id
  await referralService.linkReferrer({ refereeId: friend.id, referrerId: referrer.id, userId: reception.id })

  const fee = await paymentService.getConsultationFee(OUTRAM)
  await paymentService.create({ paymentType: "CONSULTATION", patientId: friend.id, branchId: OUTRAM, amount: fee, mode: "CASH" } as any, reception.id)
  const { visit } = await queueService.addToQueue({ patientId: friend.id, branchId: OUTRAM, visitType: "CONSULTATION", chiefComplaint: "E2E", doctorId: doctor.id }, reception.id)
  await estimateService.create(
    { patientId: friend.id, branchId: OUTRAM, visitId: visit.id, items: [{ treatmentName: "Root Canal", category: "ENDODONTICS", quantity: 1, unitRate: 6000, unitRateMax: 12000, sortOrder: 0 }] } as any,
    doctor.id
  )

  // Booked at New Alipore — must show for Outram reception too.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  await prisma.appointment.create({
    data: { patientId: friend.id, doctorId: doctor.id, branchId: ALIPORE, scheduledAt: new Date(`${today}T23:30:00+05:30`), reason: "E2E cross-branch", createdById: reception.id },
  })
})

test.afterAll(async () => { await prisma.$disconnect() })

test.describe("Doctor", () => {
  test.use({ storageState: "tests/e2e/.auth/doctor.json" })

  test("referred patient shows who referred them and when", async ({ page }) => {
    await page.goto(`/patients/${ids.friend}/referrals`)
    await expect(page.getByText("Referred by").first()).toBeVisible()
    await expect(page.getByRole("link", { name: ids.referrerName })).toBeVisible()
  })

  test("doctor gives the referrer a free check-up and marks it used", async ({ page }) => {
    await page.goto(`/patients/${ids.referrer}/referrals`)
    await expect(page.getByText(ids.friendName)).toBeVisible()
    await page.getByRole("button", { name: /give reward/i }).click()
    await page.getByRole("button", { name: "Free check-up" }).click()
    await page.getByRole("dialog").getByRole("button", { name: /give reward/i }).click()
    await expect(page.getByText("Free check-up").first()).toBeVisible()
    page.once("dialog", (d) => d.accept("Done today"))
    await page.getByRole("button", { name: /mark used/i }).click()
    await expect(page.getByText(/Used .*Done today/)).toBeVisible()
  })

  test("quote is not pending; billing a treatment creates the invoice", async ({ page, context }) => {
    await page.goto(`/patients/${ids.friend}/payments`)
    await expect(page.getByText("Treatment billing")).toBeVisible()
    await expect(page.getByText(/Due:\s*₹0/)).toBeVisible()
    await page.getByTestId("open-invoice-dialog").click()
    await page.getByLabel("Bill Root Canal").check()
    const price = page.getByRole("dialog").locator('input[type="number"]').nth(1)
    await price.fill("8500")
    await expect(page.getByTestId("invoice-total")).toHaveText(/8,500/)
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: /create invoice/i }).click(),
    ])
    await expect(popup).toHaveURL(/\/print\/invoice\//)
    await expect(popup.getByText(/INV-\d{4}-\d{5}/)).toBeVisible()
    await page.reload()
    await expect(page.getByText("Treatment Invoices")).toBeVisible()
    await expect(page.getByText(/Due:\s*₹8,500/)).toBeVisible()
  })
})

test.describe("Reception", () => {
  test.use({ storageState: "tests/e2e/.auth/reception.json" })

  test("Outram reception sees an appointment booked at New Alipore", async ({ page }) => {
    await page.goto("/appointments")
    await expect(page.getByText(ids.friendName).first()).toBeVisible()
  })

  test("registration finds the referrer by mobile number", async ({ page }) => {
    await page.goto("/patients/new")
    await page.getByPlaceholder("Referral code or mobile no.").fill(ids.referrerMobile)
    await page.getByRole("button", { name: "Find" }).click()
    await expect(page.getByText(ids.referrerName)).toBeVisible()
  })
})
