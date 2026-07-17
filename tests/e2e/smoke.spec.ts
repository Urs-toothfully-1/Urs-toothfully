import { test, expect } from "@playwright/test"

/**
 * Smoke tests — no authentication, no database writes.
 * These verify the login surface renders and client-side validation works.
 * Safe to run even before the database is seeded.
 */
test.describe("Login page (smoke)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
  })

  test("renders the login form with email, password and submit", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("blocks submission when fields are empty (native validation)", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click()
    // Still on the login page; the required email field reports invalid.
    await expect(page).toHaveURL(/\/login/)
    const emailInvalid = await page
      .getByLabel(/email/i)
      .evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(emailInvalid).toBe(true)
  })

  test("rejects a malformed email format", async ({ page }) => {
    await page.getByLabel(/email/i).fill("not-an-email")
    await page.getByLabel(/^password$/i).fill("whatever123")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("password visibility toggle works", async ({ page }) => {
    const pwd = page.getByLabel(/^password$/i)
    await pwd.fill("secret123")
    await expect(pwd).toHaveAttribute("type", "password")
    await page.getByRole("button", { name: /show password/i }).click()
    await expect(pwd).toHaveAttribute("type", "text")
    await page.getByRole("button", { name: /hide password/i }).click()
    await expect(pwd).toHaveAttribute("type", "password")
  })

  test("shows an error for invalid credentials", async ({ page }) => {
    // Requires the app + DB to be running so the server action can respond.
    await page.getByLabel(/email/i).fill("nobody@toothfully.in")
    await page.getByLabel(/^password$/i).fill("WrongPass@123")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})
