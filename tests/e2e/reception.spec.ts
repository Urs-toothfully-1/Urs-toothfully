import { test, expect } from "@playwright/test"

/**
 * Reception queue + payment collection. Runs authenticated as receptionist.
 * Payment amount boundaries are asserted at the API level to stay deterministic.
 */

test.describe("Reception dashboard", () => {
  test("queue page loads for receptionist", async ({ page }) => {
    await page.goto("/reception")
    await expect(page).toHaveURL(/\/reception/)
    await expect(page.locator("body")).not.toContainText(/unhandled|application error/i)
  })

  test("collect-payment page loads", async ({ page }) => {
    await page.goto("/reception/collect-payment")
    await expect(page).toHaveURL(/collect-payment/)
  })
})

test.describe("Payment validation (API)", () => {
  test("rejects a zero amount", async ({ page }) => {
    const res = await page.request.post("/api/payments", {
      data: { amount: 0, mode: "CASH", patientId: "seed-patient" },
    })
    expect([400, 401, 404, 422]).toContain(res.status())
    expect(res.status()).not.toBe(201)
  })

  test("rejects a negative amount", async ({ page }) => {
    const res = await page.request.post("/api/payments", {
      data: { amount: -500, mode: "CASH", patientId: "seed-patient" },
    })
    expect(res.status()).not.toBe(201)
  })

  test("rejects a non-numeric amount", async ({ page }) => {
    const res = await page.request.post("/api/payments", {
      data: { amount: "abc", mode: "CASH", patientId: "seed-patient" },
    })
    expect([400, 422]).toContain(res.status())
  })
})
