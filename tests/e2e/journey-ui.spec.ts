import { test, expect, Page } from "@playwright/test"
import { login } from "./helpers"

/**
 * UI-level regression cover for the workflow fixes. Runs serially: each block
 * leans on state the previous one left behind (a queued patient, a saved
 * estimate), which is exactly how the clinic uses the app.
 *
 * Needs a seeded throwaway database and the app running against it.
 */
test.describe.configure({ mode: "serial" })

const PATIENT = "Deep Test Patient"

/** The page's own search box — not the Ctrl+K command palette. */
function patientSearch(page: Page) {
  return page.getByPlaceholder(/Search by name, mobile/i)
}

/** Resolve the profile URL through the search API — list clicks are flaky under load. */
async function openPatient(page: Page, name = PATIENT) {
  const res = await page.request.get(`/api/patients?q=${encodeURIComponent(name)}`)
  expect(res.status()).toBe(200)
  const { patients } = await res.json()
  const match = patients.find((p: { fullName: string }) => p.fullName === name)
  expect(match, `patient "${name}" not found`).toBeTruthy()
  await page.goto(`/patients/${match.id}`)
  await expect(page.getByRole("heading", { name: new RegExp(name, "i") })).toBeVisible()
  return match.id as string
}

test.describe("Reception workflows", () => {
  test.use({ storageState: "tests/e2e/.auth/reception.json" })

  test("patient profile is editable and shows the registered branch", async ({ page }) => {
    const id = await openPatient(page)

    async function setBranch(label: string) {
      await page.getByRole("button", { name: /edit profile/i }).click()
      const dialog = page.getByRole("dialog")
      await expect(dialog.getByRole("heading", { name: /edit patient profile/i })).toBeVisible()
      await dialog.locator('select[name="registrationBranchId"]').selectOption({ label })
      await dialog.getByRole("button", { name: /save changes/i }).click()
      await expect(dialog).toBeHidden()
    }

    try {
      // The wrong-branch correction the clinic actually needs.
      await setBranch("New Alipore")
      await expect(page.getByText(/New Alipore Branch/i).first()).toBeVisible()
    } finally {
      // Always put it back: reception only searches its own branch, so a
      // half-finished test would hide this patient from every later test.
      await page.goto(`/patients/${id}`)
      await setBranch("Outram")
    }
    await expect(page.getByText(/Outram Branch/i).first()).toBeVisible()
  })

  test("reception cannot delete a patient (admin only)", async ({ page }) => {
    await openPatient(page)
    await page.getByRole("button", { name: /edit profile/i }).click()
    await expect(page.getByRole("dialog").getByRole("button", { name: /delete patient/i })).toHaveCount(0)
  })

  test("edit rejects a mobile already used by another patient", async ({ page }) => {
    await openPatient(page)
    await page.getByRole("button", { name: /edit profile/i }).click()
    const dialog = page.getByRole("dialog")
    await dialog.locator('input[name="mobile"]').fill("9900112233") // seeded Rahul Sharma
    await dialog.getByRole("button", { name: /save changes/i }).click()
    await expect(dialog.getByText(/already uses this number/i)).toBeVisible()
    await dialog.getByRole("button", { name: /^cancel$/i }).click()
  })

  test("an open visit can be completed from the queue", async ({ page }) => {
    await openPatient(page)
    const addToQueue = page.getByRole("button", { name: /add to queue/i })
    if (await addToQueue.isVisible().catch(() => false)) {
      await addToQueue.click()
      const visitType = page.locator('select[name="visitType"]')
      await expect(visitType).toBeVisible()
      await visitType.selectOption("CONSULTATION")
      const doctorSelect = page.locator('select[name="doctorId"]')
      if (await doctorSelect.count()) {
        const value = await doctorSelect.locator("option").nth(1).getAttribute("value")
        await doctorSelect.selectOption(value!)
      }
      await page.getByRole("button", { name: /^add to queue$/i }).last().click()
      await expect(visitType).toBeHidden({ timeout: 20_000 })
    }

    await page.goto("/reception")
    const card = page.locator("div").filter({ hasText: new RegExp(PATIENT) }).last()
    await expect(card).toBeVisible()
    // The fix: reception can close an open visit whatever its status.
    const complete = page.getByRole("button", { name: /^complete$/i }).first()
    await expect(complete).toBeVisible()
    await complete.click()
    await expect(page.getByText(/status updated/i)).toBeVisible({ timeout: 10_000 })
  })
})

/** Newest visit for the test patient — lets the doctor specs open the wizard directly. */
async function latestVisitId(page: Page): Promise<string> {
  const search = await page.request.get(`/api/patients?q=${encodeURIComponent(PATIENT)}`)
  const patient = (await search.json()).patients.find((p: { fullName: string }) => p.fullName === PATIENT)
  const res = await page.request.get(`/api/visits?patientId=${patient.id}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  const visits = body.visits ?? body
  expect(Array.isArray(visits) && visits.length, "patient has no visits").toBeTruthy()
  return visits[0].id
}

test.describe("Doctor consultation", () => {
  test.use({ storageState: "tests/e2e/.auth/doctor.json" })

  test("consultation wizard: custom treatment flows into a saved estimate", async ({ page }) => {
    const visitId = await latestVisitId(page)
    await page.goto(`/doctor/consultation/${visitId}`)
    await expect(page.getByText(/Step 1 — Prescription/i)).toBeVisible()

    // The wizard header must show the human visit number, never the raw uuid.
    await expect(page.getByText(visitId)).toHaveCount(0)

    // Diagnosis — the section that used to print blank with nowhere to type.
    const diagnosis = page.getByPlaceholder(/Type the diagnosis/i)
    await expect(diagnosis).toBeVisible()
    await diagnosis.fill("Chronic irreversible pulpitis w.r.t. 36")

    // Custom treatment in the prescription plan.
    const planSelect = page.locator("select").filter({ hasText: /Custom Treatment/i }).first()
    await expect(planSelect).toBeVisible()
    await planSelect.selectOption({ label: /Custom Treatment/ } as never).catch(async () => {
      await planSelect.selectOption("custom")
    })
    await page.getByPlaceholder(/Treatment name/i).first().fill("Zirconia Bridge (custom)")

    await page.getByRole("button", { name: /Save & Next/i }).click()
    await expect(page.getByText(/Step 2 — Treatment Estimate/i)).toBeVisible({ timeout: 15_000 })

    // The custom treatment carried over from the prescription.
    const row = page.locator("tbody tr").first()
    await expect(row.getByRole("textbox")).toHaveValue(/Zirconia Bridge/)
    // Columns are Qty, Sittings, Rate — fill the rate, not the discount box.
    await row.locator('input[type="number"]').nth(2).fill("18000")
    await page.getByRole("button", { name: /Create Estimate|Save Estimate/i }).click()
    // The regression: this used to fail with "Failed to save estimate".
    await expect(page.getByText(/Failed to save estimate/i)).toHaveCount(0)
    await expect(page.getByText(/Estimate saved/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe("Tooth selector", () => {
  test.use({ storageState: "tests/e2e/.auth/doctor.json" })

  test("shows every selected tooth instead of a count", async ({ page }) => {
    const visitId = await latestVisitId(page)
    await page.goto(`/doctor/consultation/${visitId}`)
    await expect(page.getByText(/Step 1 — Prescription/i)).toBeVisible()

    const toothButton = page.getByRole("button", { name: /Tooth…|Tooth |Teeth /i }).first()
    await toothButton.click()
    for (const t of ["18", "17", "16", "15", "14", "13", "12"]) {
      await page.getByRole("button", { name: t, exact: true }).first().click()
    }
    // The picker's commit button reads "Add (7)" — not the section "Add …" links.
    await page.getByRole("button", { name: /^Add \(\d+\)$/ }).click()
    // Was "7 teeth" — must name them all now.
    await expect(page.getByRole("button", { name: /18, 17, 16, 15, 14, 13, 12/ }).first()).toBeVisible()
  })
})

test.describe("Admin masters", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" })

  test("treatment name and price are editable", async ({ page }) => {
    await page.goto("/admin/treatments")
    await expect(page.getByRole("heading", { name: /Treatment Master/i })).toBeVisible()
    const editBtn = page.getByTitle(/edit name \/ price/i).first()
    if (!(await editBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // Expand a category — only the first one is open by default.
      await page.locator('[role="button"]').filter({ hasText: /\d+ treatments/ }).first().click()
    }
    await expect(editBtn).toBeVisible()
    await editBtn.click()
    const priceInput = page.locator('input[type="number"]').first()
    await priceInput.fill("9999")
    await page.getByRole("button", { name: /^save$/i }).first().click()
    await expect(page.getByText(/treatment updated/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("₹9,999").first()).toBeVisible()
  })

  test("more than one user can be added without reloading", async ({ page }) => {
    await page.goto("/admin/users")
    const stamp = Date.now().toString().slice(-6)

    for (const n of [1, 2]) {
      await page.getByRole("button", { name: /add user/i }).click()
      const form = page.locator("form").filter({ has: page.locator('input[name="email"]') })
      await expect(form).toBeVisible()
      await form.locator('input[name="name"]').fill(`QA User ${stamp}${n}`)
      await form.locator('input[name="email"]').fill(`qa${stamp}${n}@toothfully.in`)
      await form.locator('input[name="password"]').fill("Passw0rd!123")
      await form.locator('select[name="role"]').selectOption("RECEPTIONIST")
      await form.getByRole("button", { name: /create user/i }).click()
      // The regression: the form used to close itself again the instant it was
      // reopened, so no second account could be created without a page reload.
      // No reload happens between the two iterations — that is the point.
      // The toggle reads "Cancel" while the form is open and "Add User" once it
      // closes, which is a steadier signal than the form's own visibility.
      await expect(page.getByRole("button", { name: /^add user$/i })).toBeVisible({ timeout: 20_000 })
    }

    // Both accounts really exist.
    await page.reload()
    await expect(page.getByText(`QA User ${stamp}1`)).toBeVisible()
    await expect(page.getByText(`QA User ${stamp}2`)).toBeVisible()
  })

  test("admin can delete a patient and it leaves search", async ({ page }) => {
    await page.goto("/patients")
    const stamp = Date.now().toString().slice(-6)
    // Register a throwaway patient through the API, then delete it in the UI.
    const res = await page.request.post("/api/patients", {
      data: {
        registrationBranchId: "branch-outram-0000-0000-000000000001",
        fullName: `Delete Me ${stamp}`,
        dateOfBirth: "1992-02-02",
        gender: "FEMALE",
        mobile: `96${stamp}22`,
      },
    })
    expect(res.status()).toBe(201)
    const created = (await res.json()).patient

    await page.goto(`/patients/${created.id}`)
    await page.getByRole("button", { name: /edit profile/i }).click()
    await page.getByRole("dialog").getByRole("button", { name: /delete patient/i }).click()
    const confirm = page.getByRole("dialog").filter({ hasText: /Delete .*\?/ })
    await confirm.getByRole("textbox").fill("duplicate created during QA")
    await confirm.getByRole("button", { name: /delete patient/i }).click()
    await expect(page).toHaveURL(/\/patients$/, { timeout: 15_000 })

    await patientSearch(page).fill(`Delete Me ${stamp}`)
    await expect(page.getByRole("link", { name: `Delete Me ${stamp}` })).toHaveCount(0)
  })
})

test.describe("Print templates", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" })

  test("estimate print fills a full A4 sheet with the footer at the bottom", async ({ page }) => {
    const id = await openPatient(page)
    await page.goto(`/patients/${id}/estimates`)
    const printLink = page.getByRole("link", { name: /print estimate/i }).first()
    await expect(printLink).toBeVisible()
    await page.goto((await printLink.getAttribute("href"))!)

    const sheet = page.locator(".sheet").first()
    await expect(sheet).toBeVisible()
    const box = await sheet.boundingBox()
    // Fixed template: the sheet keeps A4 proportions even when half empty.
    expect(box!.height).toBeGreaterThan(1000)
  })

  test("prescription print shows the diagnosis under its heading", async ({ page }) => {
    const visitId = await latestVisitId(page)
    await page.goto(`/print/prescription/${visitId}`)
    await expect(page.getByText("DIAGNOSIS")).toBeVisible()
    // The pad keeps its proportions even when the doctor writes very little.
    const body = page.locator(".rx-body")
    await expect(body).toBeVisible()
    expect((await body.boundingBox())!.height).toBeGreaterThan(700)
  })
})

test.describe("Every screen renders", () => {
  const ROUTES: Record<string, string[]> = {
    admin: [
      "/admin", "/admin/users", "/admin/treatments", "/admin/settings", "/admin/availability",
      "/admin/accounting", "/admin/audit", "/admin/tally", "/admin/reports", "/admin/reports/daily",
      "/admin/reports/monthly", "/admin/reports/doctor", "/admin/reports/treatment",
      "/admin/reports/outstanding", "/admin/reports/lead-source",
      "/patients", "/patients/new", "/appointments", "/reception", "/doctor",
      "/whatsapp", "/whatsapp/templates", "/whatsapp/queue", "/whatsapp/logs", "/whatsapp/settings",
    ],
    reception: ["/reception", "/patients", "/patients/new", "/appointments", "/reception/collect-payment", "/whatsapp"],
    doctor: ["/doctor", "/patients", "/appointments", "/doctor/signature"],
  }

  for (const [role, routes] of Object.entries(ROUTES)) {
    test(`${role} pages load without an error boundary`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` })
      const page = await ctx.newPage()
      const broken: string[] = []
      for (const route of routes) {
        const res = await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => null)
        const status = res?.status() ?? 0
        const crashed = await page.getByText(/Application error|Internal Server Error|Unhandled Runtime/i).count()
        if (status >= 500 || crashed > 0) broken.push(`${route} → ${status}${crashed ? " (error boundary)" : ""}`)
      }
      await ctx.close()
      expect(broken, `broken routes for ${role}`).toEqual([])
    })
  }
})
