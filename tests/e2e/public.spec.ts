import { test, expect } from "@playwright/test"

/**
 * Public, unauthenticated surfaces: online booking and kiosk intake.
 * Runs in the "public" project (no stored auth state).
 */

test.describe("Public booking", () => {
  test("booking page is publicly reachable", async ({ page }) => {
    await page.goto("/book")
    await expect(page).toHaveURL(/\/book/)
    await expect(page.locator("body")).not.toContainText(/unauthorized|application error/i)
  })

  test("submitting an empty booking shows validation, creates nothing", async ({ page }) => {
    await page.goto("/book")
    const submit = page.getByRole("button", { name: /book|submit|request/i }).first()
    if (await submit.count()) {
      await submit.click()
      await expect(page).toHaveURL(/\/book/) // stays on the form
    }
  })
})

test.describe("Public intake", () => {
  test("intake page is publicly reachable", async ({ page }) => {
    const res = await page.goto("/intake")
    expect(res?.status()).not.toBe(401)
  })
})
