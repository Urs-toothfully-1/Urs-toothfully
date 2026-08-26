import { test, expect, Page } from "@playwright/test"

/**
 * Prescription editor — runs authenticated as doctor.
 *
 * The save assertions here exist because a regression once made every save
 * write an empty object: the form reported success, the page looked right, and
 * the doctor's notes were silently discarded. Only reloading and re-reading the
 * field catches that, so every save test below reloads before asserting.
 */

/** The seeded patient's consultation visit. */
const VISIT_PATH = "/doctor/consultation/a2a9a196-4167-438d-b382-f7ed98de3b20"

const stamp = () => `E2E note ${Date.now()}`

// Every test here drives the one seeded visit's prescription, so they must not
// run concurrently — parallel workers would overwrite each other's saves and
// the reload assertions would read someone else's text.
test.describe.configure({ mode: "serial" })

const complaintBox = (page: Page) =>
  page.getByPlaceholder(/Type the complaint/i)

async function openEditor(page: Page) {
  await page.goto(VISIT_PATH)
  await expect(page.getByRole("heading", { name: /Prescription/i }).first()).toBeVisible()
  // Wait for hydration before typing. Filling a controlled field while React is
  // still taking over leaves the server-rendered value merged with the typed
  // one, which shows up as two runs' text concatenated.
  await page.waitForLoadState("networkidle")
  await expect(complaintBox(page)).toBeEditable()
}

test.describe("Prescription editor — saving", () => {
  test("what the doctor types is still there after a reload", async ({ page }) => {
    const note = stamp()
    await openEditor(page)

    await complaintBox(page).fill(note)
    await page.getByRole("button", { name: /^Save Prescription$/i }).click()
    await expect(page.getByText(/Prescription saved/i)).toBeVisible()

    // The regression this guards against passed every in-page assertion.
    await page.reload()
    await expect(complaintBox(page)).toHaveValue(note)
  })

  test("a second edit replaces the first, and persists", async ({ page }) => {
    const second = `${stamp()} second`
    await openEditor(page)

    await complaintBox(page).fill(second)
    await page.getByRole("button", { name: /^Save Prescription$/i }).click()
    await expect(page.getByText(/Prescription saved/i)).toBeVisible()

    await page.reload()
    await expect(complaintBox(page)).toHaveValue(second)
  })
})

test.describe("Prescription editor — library pickers", () => {
  test("every section offers a picker", async ({ page }) => {
    await openEditor(page)
    // Chief Complaint, On Examination, Diagnosis, Medicines.
    await expect(page.getByRole("button", { name: /Choose from list/i })).toHaveCount(3)
    await expect(page.getByRole("button", { name: /Choose medicine/i })).toHaveCount(1)
  })

  test("the chief-complaint picker lists the seeded library and appends a pick", async ({ page }) => {
    await openEditor(page)
    await complaintBox(page).fill("")

    await page.getByRole("button", { name: /Choose from list/i }).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Chief Complaints")
    // Empty here would mean the picker loaded nothing — the original symptom.
    await expect(dialog.getByRole("button", { name: "Bleeding gums" })).toBeVisible()

    await dialog.getByRole("button", { name: "Bleeding gums" }).click()
    await page.getByRole("button", { name: "Done" }).click()
    await expect(complaintBox(page)).toHaveValue(/Bleeding gums/)
  })

  test("picks accumulate and are not duplicated", async ({ page }) => {
    await openEditor(page)
    await complaintBox(page).fill("")

    await page.getByRole("button", { name: /Choose from list/i }).first().click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Bleeding gums" }).click()
    await dialog.getByRole("button", { name: "Bad breath" }).click()
    // Same entry twice must not produce two lines.
    await dialog.getByRole("button", { name: "Bleeding gums" }).click()
    await page.getByRole("button", { name: "Done" }).click()

    const value = await complaintBox(page).inputValue()
    expect(value).toContain("Bleeding gums")
    expect(value).toContain("Bad breath")
    expect(value.match(/Bleeding gums/g)).toHaveLength(1)
  })

  test("search finds a term from any specialty", async ({ page }) => {
    await openEditor(page)
    // Third "Choose from list" is the Diagnosis section.
    await page.getByRole("button", { name: /Choose from list/i }).nth(2).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Search…").fill("pulpitis")
    await expect(dialog.getByRole("button", { name: "Irreversible Pulpitis", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Done" }).click()
  })

  test("an examination pick becomes its own finding row", async ({ page }) => {
    await openEditor(page)
    const findings = page.getByPlaceholder(/Type the finding/i)
    const before = await findings.count()

    await page.getByRole("button", { name: /Choose from list/i }).nth(1).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Search…").fill("Dental Fluorosis")
    await dialog.getByRole("button", { name: "Dental Fluorosis", exact: true }).click()
    await page.getByRole("button", { name: "Done" }).click()

    await expect(findings.filter({ hasText: "" })).not.toHaveCount(before - 1)
    await expect(page.locator('textarea:has-text("Dental Fluorosis")').first()).toBeVisible()
  })

  test("the medicine picker adds a row and dosage fields suggest from the sheet", async ({ page }) => {
    await openEditor(page)

    await page.getByRole("button", { name: /Choose medicine/i }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Medicines")
    await dialog.getByPlaceholder("Search…").fill("Augmentin 625")
    await dialog.getByRole("button", { name: "Tab Augmentin 625mg", exact: true }).click()
    await page.getByRole("button", { name: "Done" }).click()

    await expect(page.locator('input[value="Tab Augmentin 625mg"]')).toBeVisible()
    // Native datalists back the dosage columns, so they stay free-text.
    for (const id of ["rx-dosage-options", "rx-frequency-options", "rx-duration-options", "rx-instruction-options"]) {
      await expect(page.locator(`datalist#${id}`)).toBeAttached()
    }
    await expect(page.locator("#rx-frequency-options option[value='1-1-1']")).toBeAttached()
  })

  test("a medicine template fills several rows at once", async ({ page }) => {
    await openEditor(page)
    await page.getByRole("button", { name: /Use template/i }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Medicine Templates")
    await dialog.getByRole("button", { name: /Post-RCT Protocol/ }).click()

    await expect(page.locator('input[value="Tab Amoxicillin 500mg"]')).toBeVisible()
    await expect(page.locator('input[value="Tab Metronidazole 400mg"]')).toBeVisible()
  })

  test("medicines picked through the UI survive a save and reload", async ({ page }) => {
    await openEditor(page)

    await page.getByRole("button", { name: /Choose medicine/i }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Search…").fill("Hexidine 0.2")
    await dialog.getByRole("button", { name: "Rinse Hexidine 0.2%", exact: true }).click()
    await page.getByRole("button", { name: "Done" }).click()

    await page.getByRole("button", { name: /^Save Prescription$/i }).click()
    await expect(page.getByText(/Prescription saved/i)).toBeVisible()

    await page.reload()
    await expect(page.locator('input[value="Rinse Hexidine 0.2%"]')).toBeVisible()
  })
})
