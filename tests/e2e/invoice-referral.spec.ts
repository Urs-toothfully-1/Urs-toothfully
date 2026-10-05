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

  test("doctor spends the referrer's point on a reward — once only", async ({ page }) => {
    await page.goto(`/patients/${ids.referrer}/referrals`)
    await expect(page.getByText(ids.friendName).first()).toBeVisible()
    await expect(page.getByText("1 point available", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: /use points/i }).click()
    const dialog = page.getByRole("dialog")
    await dialog.locator("select").last().selectOption("FREE_CHECKUP")
    await dialog.getByRole("button", { name: /give reward/i }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText("0 points available", { exact: true })).toBeVisible()
    await expect(page.getByText(/Used .*Given at the visit/)).toBeVisible()
    await expect(page.getByRole("button", { name: /use points/i })).toBeDisabled()
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

test.describe("Admin", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" })

  test("creates a reward campaign that shows on the public invite page", async ({ page, browser }) => {
    await page.goto("/admin/referrals")
    await expect(page.getByRole("heading", { name: "Rewards & Referrals" })).toBeVisible()
    await page.getByRole("button", { name: /new campaign/i }).first().click()
    const d = page.getByRole("dialog")
    await d.getByPlaceholder(/Campaign name/).fill(`E2E Campaign ${stamp}`)
    await d.getByPlaceholder(/Offer shown to patients/).first().fill("₹700 off your next visit")
    await d.getByPlaceholder(/Offer shown to patients/).last().fill(`E2E welcome gift ${stamp}`)
    await d.getByRole("button", { name: /create campaign/i }).click()
    await expect(page.getByText(`E2E Campaign ${stamp}`).first()).toBeVisible()

    const code = (await prisma.patient.findUniqueOrThrow({ where: { id: ids.referrer }, select: { referralCode: true } })).referralCode!
    const pub = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
    await pub.goto(`/rewards/${code.toLowerCase()}`)
    await expect(pub.getByText(/You.ve been invited/)).toBeVisible()
    await expect(pub.getByText(ids.referrerName.split(" ")[0]).first()).toBeVisible()
    await expect(pub.getByText(`E2E welcome gift ${stamp}`)).toBeVisible()
    // Full surname is never shown publicly.
    await expect(pub.getByText(ids.referrerName)).toHaveCount(0)
    await pub.goto("/rewards/NOPE99")
    await expect(pub.getByText(/isn.t valid/)).toBeVisible()
    await prisma.rewardCampaign.deleteMany({ where: { name: `E2E Campaign ${stamp}` } })
  })

  test("exports all patients as CSV", async ({ page }) => {
    const res = await page.request.get("/api/admin/patients/export")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("text/csv")
    const text = await res.text()
    expect(text).toContain("Patient ID,Name,Mobile")
    expect(text).toContain(ids.friendName)
  })

  test("imports potential clients from a CSV", async ({ page }) => {
    await page.goto("/admin/potential-clients")
    await page.getByRole("button", { name: /import csv/i }).click()
    const csv = `Name,Phone,City
E2E Lead ${stamp},93${stamp}11,Salt Lake
Bad Row,12345,
`
    await page.locator('input[type="file"]').setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) })
    await expect(page.getByText("2 rows found")).toBeVisible()
    await page.getByRole("button", { name: /import 2 rows/i }).click()
    await expect(page.getByText(/1 added · 0 updated · 1 skipped/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).last().click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("main").getByText(`E2E Lead ${stamp}`)).toBeVisible()
    await prisma.potentialClient.deleteMany({ where: { fullName: `E2E Lead ${stamp}` } })
  })
})

test.describe("Public", () => {
  test("booking from an invite link completes and keeps the referral", async ({ browser }) => {
    const code = (await prisma.patient.findUniqueOrThrow({ where: { id: ids.referrer }, select: { referralCode: true } })).referralCode!
    // Repeated local runs trip the public form's per-device limit — start clean.
    await prisma.intakeAttempt.deleteMany({ where: { ipAddress: { in: ["", "::1", "127.0.0.1", "::ffff:127.0.0.1", "unknown"] } } })
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage()
    await page.goto(`/rewards/${code}`)
    await page.getByRole("button", { name: /outram/i }).first().click()
    await page.locator('input[name="fullName"]').fill(`E2E Invitee ${stamp}`)
    await page.locator('input[name="mobile"]').fill(`94${stamp}21`)
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    await page.locator('input[name="preferredDate"]').fill(tomorrow)
    await page.waitForTimeout(3200) // the public form rejects submissions faster than a human (3 s)
    await page.getByRole("button", { name: /request my appointment/i }).click()
    await expect(page.getByText("Booking complete", { exact: true })).toBeVisible()
    await expect(page.getByText(/YOUR INVITATION IS SAVED/i)).toBeVisible()
    const req = await prisma.appointmentRequest.findFirst({ where: { fullName: `E2E Invitee ${stamp}` } })
    expect(req?.referralCode).toBe(code)
    await prisma.appointmentRequest.deleteMany({ where: { fullName: `E2E Invitee ${stamp}` } })
  })
})
