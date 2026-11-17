import { test, expect, type Page } from "@playwright/test"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { patientService } from "@/server/services/patient.service"
import { PRESETS } from "@/lib/permissions"

/**
 * Per-user access scenarios (lib/permissions.ts). Seeds two restricted staff
 * accounts and two patients in the LOCAL database:
 *  - a "Prescriptions only — today's patients" doctor
 *  - an "Appointments and queue only" receptionist (no prices / payments)
 * and checks pages, menus and APIs enforce them.
 */

const OUTRAM = "branch-outram-0000-0000-000000000001"
const PASSWORD = "E2eAccess@123"
const stamp = Date.now().toString().slice(-6)
const RX_DOC = { email: "e2e.rxdoc@toothfully.in", name: "Dr E2E Rx Only" }
const DESK = { email: "e2e.desk@toothfully.in", name: "E2E Front Desk" }
const ids = { today: "", other: "", rxDoc: "", desk: "" }

const overrides = (role: "DOCTOR" | "RECEPTIONIST", preset: string) =>
  Object.fromEntries(PRESETS[role].find((p) => p.id === preset)!.off.map((k) => [k, false]))

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const upsert = (
    email: string,
    name: string,
    role: "DOCTOR" | "RECEPTIONIST",
    permissions: object
  ) =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, role, branchId: OUTRAM, passwordHash, permissions },
      update: { passwordHash, permissions, isActive: true, loginAttempts: 0, lockedUntil: null },
    })
  ids.rxDoc = (await upsert(RX_DOC.email, RX_DOC.name, "DOCTOR", overrides("DOCTOR", "rx-only"))).id
  ids.desk = (
    await upsert(DESK.email, DESK.name, "RECEPTIONIST", overrides("RECEPTIONIST", "front-desk"))
  ).id

  const reception = await prisma.user.findFirstOrThrow({
    where: { email: "reception.outram@toothfully.in" },
  })
  const mk = (fullName: string, mobile: string) =>
    patientService.createWithHistory(
      {
        registrationBranchId: OUTRAM,
        fullName,
        dateOfBirth: "1990-01-01",
        gender: "FEMALE",
        mobile,
        email: `e2e${mobile}@example.com`,
        address: "E2E",
        leadSource: "",
        referenceName: "",
        reasonForVisit: "",
      } as any,
      { consentGiven: true } as any,
      reception.id
    )
  ids.today = (await mk(`E2E Access Today ${stamp}`, `95${stamp}01`)).id
  ids.other = (await mk(`E2E Access Other ${stamp}`, `95${stamp}02`)).id

  // Today's appointment with the restricted doctor — puts "today" in scope.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  await prisma.appointment.create({
    data: {
      patientId: ids.today,
      doctorId: ids.rxDoc,
      branchId: OUTRAM,
      scheduledAt: new Date(`${today}T23:00:00+05:30`),
      reason: "E2E access",
      createdById: reception.id,
    },
  })
})

test.afterAll(async () => {
  // Leave the seeded accounts unusable rather than deleting rows other tables point at.
  await prisma.user.updateMany({
    where: { email: { in: [RX_DOC.email, DESK.email] } },
    data: { isActive: false },
  })
  await prisma.$disconnect()
})

/** Next streams notFound() with HTTP 200 (there's a loading.tsx), so check the page itself. */
async function expectNotFound(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByText("Page Not Found"), path).toBeVisible()
}

async function loginAs(page: Page, email: string) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: /sign in/i }).click(),
  ])
}

test.describe("Prescription-only doctor", () => {
  test.beforeEach(async ({ page }) => loginAs(page, RX_DOC.email))

  test("patients list shows only today's patients", async ({ page }) => {
    await page.goto("/patients")
    await expect(page.getByRole("heading", { name: "Today's patients" })).toBeVisible()
    await expect(page.getByText(`E2E Access Today ${stamp}`)).toBeVisible()
    await expect(page.getByText(`E2E Access Other ${stamp}`)).toHaveCount(0)
  })

  test("a patient not booked today can't be opened", async ({ page }) => {
    await expectNotFound(page, `/patients/${ids.other}`)
    await expect(page.getByText(`E2E Access Other ${stamp}`)).toHaveCount(0)
  })

  test("today's patient opens without money, notes or documents", async ({ page }) => {
    await page.goto(`/patients/${ids.today}`)
    await expect(page.getByText(`E2E Access Today ${stamp}`).first()).toBeVisible()
    for (const tab of ["Payments", "Estimates", "Clinical Notes", "Documents"])
      await expect(page.getByRole("link", { name: new RegExp(`^${tab}`) })).toHaveCount(0)
    await expect(page.getByText("Balance", { exact: true })).toHaveCount(0)
    for (const path of ["payments", "estimates", "documents"])
      await expectNotFound(page, `/patients/${ids.today}/${path}`)
    await page.goto(`/patients/${ids.today}/notes`)
    await expect(page.getByText("Access Restricted")).toBeVisible()
  })

  test("menu hides appointments (keeps templates); the page redirects", async ({ page }) => {
    await page.goto("/doctor")
    const nav = page.locator("aside").first()
    await expect(nav.getByRole("link", { name: "Templates" })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Appointments" })).toHaveCount(0)
    await page.goto("/appointments")
    await expect(page).toHaveURL(/\/doctor$/)
  })

  test("APIs refuse money and out-of-scope patients", async ({ page }) => {
    const api = page.request
    expect((await api.get(`/api/payments?patientId=${ids.today}`)).status()).toBeGreaterThanOrEqual(
      401
    )
    expect(
      (await api.get(`/api/estimates?patientId=${ids.today}`)).status()
    ).toBeGreaterThanOrEqual(401)
    expect((await api.get(`/api/patients/${ids.other}`)).status()).toBe(404)
    expect((await api.get(`/api/visits?patientId=${ids.other}`)).status()).toBe(403)
    const search = await (
      await api.get(`/api/patients?q=${encodeURIComponent(`E2E Access`)}`)
    ).json()
    const found = (search.patients ?? []).map((p: { id: string }) => p.id)
    expect(found).not.toContain(ids.other)
    const { treatments } = await (await api.get("/api/treatments")).json()
    expect(treatments.length).toBeGreaterThan(0)
    expect(treatments.every((t: { defaultAmount: unknown }) => Number(t.defaultAmount) === 0)).toBe(
      true
    )
  })
})

test.describe("Front-desk receptionist (no prices or payments)", () => {
  test.beforeEach(async ({ page }) => loginAs(page, DESK.email))

  test("sees every patient but no money", async ({ page }) => {
    await page.goto(`/patients/${ids.other}`)
    await expect(page.getByText(`E2E Access Other ${stamp}`).first()).toBeVisible()
    await expect(page.getByText("Balance", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /^Payments/ })).toHaveCount(0)
    // Front-desk scenario also switches off "from the patient profile".
    await expect(page.getByRole("button", { name: /New prescription \/ estimate/ })).toHaveCount(0)
    await expectNotFound(page, `/patients/${ids.other}/payments`)
  })

  test("collect payment redirects; appointments still work", async ({ page }) => {
    await page.goto(`/reception/collect-payment?patientId=${ids.other}`)
    await expect(page).toHaveURL(/\/reception$/)
    await page.goto("/appointments")
    await expect(page).toHaveURL(/\/appointments/)
    expect(
      (await page.request.get(`/api/payments?patientId=${ids.other}`)).status()
    ).toBeGreaterThanOrEqual(401)
  })
})

test.describe("Admin access screen", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" })

  test("shows the scenario and saves a change", async ({ page }) => {
    await page.goto("/admin/users")
    const row = page
      .locator("div", { hasText: RX_DOC.email })
      .filter({ has: page.getByRole("button", { name: /limited access/i }) })
      .last()
    await row.getByRole("button", { name: /limited access/i }).click()
    await expect(page.getByRole("radio", { name: /Prescriptions only/ })).toBeChecked()
    // The open scenario lists what they get; untick/tick works inside it.
    await expect(page.getByRole("checkbox", { name: /Write prescriptions/ })).toBeChecked()
    await page.getByRole("radio", { name: /Clinical only/ }).click()
    await expect(page.getByRole("checkbox", { name: /Clinical notes/ })).toBeChecked()
    await page.getByRole("checkbox", { name: /Patient documents/ }).uncheck()
    await expect(page.getByText("customised")).toBeVisible()
    await page.getByRole("button", { name: "Save access" }).click()
    await expect(page.getByText(`Access updated for ${RX_DOC.name}`)).toBeVisible()
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: ids.rxDoc },
      select: { permissions: true },
    })
    expect(saved.permissions).toEqual({ prices: false, payments: false, estimates: false, documents: false })
  })
})
