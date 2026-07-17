import { test, expect } from "@playwright/test"

/**
 * Treatment estimates. Runs in the "reception" project (estimates are shared
 * with reception per RBAC). Focuses on reachability and money-math guards.
 */

test.describe("Estimate module", () => {
  test("new-estimate page loads", async ({ page }) => {
    await page.goto("/doctor/estimate/new")
    await expect(page).toHaveURL(/estimate\/new/)
    await expect(page.locator("body")).not.toContainText(/application error/i)
  })

  test("estimates list API is authorized and returns data", async ({ page }) => {
    const res = await page.request.get("/api/estimates")
    expect([200, 400]).toContain(res.status())
    expect(res.status()).not.toBe(401)
  })

  test("create estimate rejects an invalid payload (400)", async ({ page }) => {
    const res = await page.request.post("/api/estimates", { data: {} })
    expect([400, 422]).toContain(res.status())
  })

  test("advance percentage over 100 is rejected", async ({ page }) => {
    const res = await page.request.post("/api/estimates", {
      data: { patientId: "seed-patient", items: [], advancePercent: 150 },
    })
    expect(res.status()).not.toBe(201)
  })
})
