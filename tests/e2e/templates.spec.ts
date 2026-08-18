import { test, expect, Page } from "@playwright/test"

/**
 * Templates management — runs authenticated as doctor.
 *
 * Opening the Add/Edit dialogs is deliberately its own assertion: the dialogs
 * once crashed on click because their option lists were exported from a
 * "use server" module and arrived undefined. Build, typecheck and lint all
 * passed while that was broken, so only a real click catches it.
 */

/** Unique per run so repeat runs never collide on the branch-unique name. */
const stamp = () => `E2E ${Date.now()}${Math.floor(Math.random() * 1000)}`

async function openTab(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).click()
}

test.describe("Templates page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/templates")
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible()
  })

  test("shows a tab for every template kind", async ({ page }) => {
    for (const tab of [/Chief Complaints/, /Diagnosis & Examination/, /Medicines/, /Medicine Protocols/]) {
      await expect(page.getByRole("button", { name: tab })).toBeVisible()
    }
    await expect(page.locator("body")).not.toContainText(/application error|something went wrong/i)
  })

  test("the seeded library is listed, not empty", async ({ page }) => {
    await expect(page.getByText("Bleeding gums")).toBeVisible()
    await openTab(page, /Diagnosis & Examination/)
    await expect(page.getByText("Irreversible Pulpitis", { exact: true })).toBeVisible()
    await openTab(page, /^Medicines/)
    await expect(page.getByText("Tab Augmentin 625mg")).toBeVisible()
  })

  test("Add opens a working dialog for each kind", async ({ page }) => {
    await page.getByRole("button", { name: /Add entry/ }).click()
    await expect(page.getByRole("dialog")).toContainText(/New chief complaint/i)
    // A crashed dialog renders the error boundary instead of the form.
    await expect(page.getByRole("dialog").getByRole("combobox")).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()

    await openTab(page, /^Medicines/)
    await page.getByRole("button", { name: /Add medicine/ }).click()
    await expect(page.getByRole("dialog")).toContainText(/New medicine/i)
    await expect(page.getByRole("dialog").getByRole("combobox")).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()

    await openTab(page, /Medicine Protocols/)
    await page.getByRole("button", { name: /Add protocol/ }).click()
    await expect(page.getByRole("dialog")).toContainText(/New protocol/i)
    await page.getByRole("button", { name: "Cancel" }).click()

    await expect(page.locator("body")).not.toContainText(/something went wrong|undefined/i)
  })

  test("Edit opens prefilled with the existing entry", async ({ page }) => {
    const row = page.locator("div").filter({ hasText: /^Bleeding gums$/ }).first()
    await row.getByRole("button", { name: "Edit" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText(/Edit entry/i)
    await expect(dialog.getByRole("textbox").first()).toHaveValue("Bleeding gums")
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("creates, renames, archives and restores a complaint", async ({ page }) => {
    const name = stamp()
    const renamed = `${name} renamed`

    await page.getByRole("button", { name: /Add entry/ }).click()
    await page.getByRole("dialog").getByRole("textbox").first().fill(name)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()

    // Rename
    const created = page.locator("div").filter({ hasText: new RegExp(`^${name}$`) }).last()
    await created.getByRole("button", { name: "Edit" }).click()
    await page.getByRole("dialog").getByRole("textbox").first().fill(renamed)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText(renamed, { exact: true })).toBeVisible()
    await expect(page.getByText(name, { exact: true })).toHaveCount(0)

    // Archive removes it from the working list but not from the database.
    const row = page.locator("div").filter({ hasText: new RegExp(`^${renamed}$`) }).last()
    await row.getByRole("button", { name: "Archive" }).click()
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0)

    // An archived row is labelled, so it no longer matches exactly.
    await page.getByLabel(/Show archived/i).check()
    await expect(page.getByText(renamed).first()).toBeVisible()
    await expect(page.getByText(`${renamed}(archived)`)).toBeVisible()

    // Restore so the entry is left usable rather than hidden. Identify the row
    // by the button it offers rather than by matching its decorated text.
    const archived = page
      .locator("div")
      .filter({ hasText: renamed })
      .filter({ has: page.getByRole("button", { name: "Restore" }) })
      .last()
    await archived.getByRole("button", { name: "Restore" }).click()
    await expect(page.getByText(renamed, { exact: true })).toBeVisible()
  })

  test("a duplicate name is refused and the dialog keeps what was typed", async ({ page }) => {
    await page.getByRole("button", { name: /Add entry/ }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox").first().fill("Bleeding gums")
    await page.getByRole("button", { name: "Save" }).click()

    // Stays open with the text intact so the clash can be corrected.
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("textbox").first()).toHaveValue("Bleeding gums")
    await expect(page.getByText(/already in this list/i)).toBeVisible()
    await page.getByRole("button", { name: "Cancel" }).click()
  })

  test("creates a protocol, then editing replaces its medicines", async ({ page }) => {
    const name = stamp()
    await openTab(page, /Medicine Protocols/)
    await page.getByRole("button", { name: /Add protocol/ }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Post-extraction").fill(name)
    await dialog.getByPlaceholder("Medicine").first().fill("Tab Augmentin 625mg")
    await dialog.getByPlaceholder("1-0-1").first().fill("1-0-1")
    await dialog.getByPlaceholder("5 days").first().fill("5 days")
    await page.getByRole("button", { name: "Save" }).click()

    const card = page.locator("div.rounded-lg.border").filter({ hasText: name })
    await expect(card).toContainText("Tab Augmentin 625mg")

    // Editing replaces the item list rather than appending to it.
    await card.getByRole("button", { name: "Edit" }).click()
    const edit = page.getByRole("dialog")
    await edit.getByPlaceholder("Medicine").first().fill("Tab Dolo 650mg")
    await page.getByRole("button", { name: "Save" }).click()

    const updated = page.locator("div.rounded-lg.border").filter({ hasText: name })
    await expect(updated).toContainText("Tab Dolo 650mg")
    await expect(updated).not.toContainText("Tab Augmentin 625mg")

    // Clean up so repeat runs start from the same place.
    page.once("dialog", (d) => d.accept())
    await updated.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText(name)).toHaveCount(0)
  })

  test("search narrows the list", async ({ page }) => {
    await openTab(page, /^Medicines/)
    await page.getByPlaceholder(/Search medicines/i).fill("Augmentin")
    await expect(page.getByText("Tab Augmentin 625mg")).toBeVisible()
    await expect(page.getByText("Tab Dolo 650mg")).toHaveCount(0)
  })
})
