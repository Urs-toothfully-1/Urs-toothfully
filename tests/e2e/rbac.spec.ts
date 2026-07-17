import { test, expect, request as pwRequest } from "@playwright/test"
import { login, USERS } from "./helpers"

/**
 * Role-based access control. Mirrors the guard table in proxy.ts.
 * Each test uses a fresh context (login inside the test) to keep roles isolated.
 */

test.describe("Unauthenticated access", () => {
  test("protected page redirects to /login", async ({ page }) => {
    await page.goto("/patients")
    await expect(page).toHaveURL(/\/login/)
  })

  test("protected API returns 401 JSON", async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({ baseURL })
    const res = await ctx.get("/api/patients?q=raj")
    expect(res.status()).toBe(401)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/unauthorized/i) })
    await ctx.dispose()
  })

  test("invalid session cookie is cleared and redirected", async ({ page, context }) => {
    await context.addCookies([
      { name: "toothfully_session", value: "tampered.jwt.value", url: "http://localhost:3000" },
    ])
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Doctor role boundaries", () => {
  test.beforeEach(async ({ page }) => login(page, "doctor"))

  test("cannot reach the admin area", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page).toHaveURL(/\/doctor/)
  })

  test("can reach the shared estimate module", async ({ page }) => {
    await page.goto("/doctor/estimate")
    await expect(page).toHaveURL(/\/doctor\/estimate/)
  })
})

test.describe("Receptionist role boundaries", () => {
  test.beforeEach(async ({ page }) => login(page, "reception"))

  test("cannot reach doctor consultation", async ({ page }) => {
    await page.goto("/doctor/consultation")
    await expect(page).not.toHaveURL(/\/doctor\/consultation/)
  })

  test("cannot reach whatsapp settings (admin only)", async ({ page }) => {
    await page.goto("/whatsapp/settings")
    await expect(page).not.toHaveURL(/\/whatsapp\/settings/)
  })

  test("can reach the whatsapp queue", async ({ page }) => {
    await page.goto("/whatsapp/queue")
    await expect(page).toHaveURL(/\/whatsapp\/queue/)
  })
})

test.describe("Cross-role API authorization", () => {
  test("doctor cannot create a patient (403)", async ({ browser }) => {
    // Log in as doctor to obtain a valid session, then call a reception/admin-only write.
    const context = await browser.newContext()
    const page = await context.newPage()
    await login(page, "doctor")
    const res = await page.request.post("/api/patients", {
      data: {
        registrationBranchId: "any",
        fullName: "Test Patient",
        dateOfBirth: "1990-01-01",
        gender: "MALE",
        mobile: "9876543210",
      },
    })
    expect(res.status()).toBe(403)
    await context.close()
  })
})

test("seed users are defined for all three roles", async () => {
  expect(Object.keys(USERS).sort()).toEqual(["admin", "doctor", "reception"])
})
