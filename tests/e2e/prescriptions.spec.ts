import { test, expect } from "@playwright/test"

/**
 * Prescriptions — runs authenticated as doctor.
 */

test.describe("Prescription module", () => {
  // Without a visit there is nothing to prescribe against, so the page sends
  // the doctor back to their queue rather than rendering an orphan form.
  test("new prescription without a visit redirects to the queue", async ({ page }) => {
    await page.goto("/doctor/prescription/new")
    await expect(page).toHaveURL(/\/doctor$/)
    await expect(page.locator("body")).not.toContainText(/application error/i)
  })

  test("prescription list page loads", async ({ page }) => {
    await page.goto("/doctor/prescription")
    await expect(page).toHaveURL(/prescription/)
  })
})
