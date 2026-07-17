import { test, expect } from "@playwright/test"

/**
 * Prescriptions — runs authenticated as doctor.
 */

test.describe("Prescription module", () => {
  test("new prescription page loads", async ({ page }) => {
    await page.goto("/doctor/prescription/new")
    await expect(page).toHaveURL(/prescription\/new/)
    await expect(page.locator("body")).not.toContainText(/application error/i)
  })

  test("prescription list page loads", async ({ page }) => {
    await page.goto("/doctor/prescription")
    await expect(page).toHaveURL(/prescription/)
  })
})
