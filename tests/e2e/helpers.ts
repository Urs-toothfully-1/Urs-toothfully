import { Page, expect } from "@playwright/test"

/** Seed credentials (from prisma/seed.ts). Change if your seed differs. */
export const USERS = {
  admin: { email: "admin@toothfully.in", password: "Admin@123", home: "/admin" },
  doctor: { email: "dr.jashwant@toothfully.in", password: "Doctor@123", home: "/doctor" },
  reception: { email: "reception.outram@toothfully.in", password: "Reception@123", home: "/reception" },
} as const

export type RoleKey = keyof typeof USERS

/**
 * Log in through the real login form (server action) using user-facing locators.
 * Waits for the post-login navigation away from /login via auto-waiting.
 */
export async function login(page: Page, role: RoleKey): Promise<void> {
  const user = USERS[role]
  await page.goto("/login")

  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/^password$/i).fill(user.password)

  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: /sign in/i }).click(),
  ])

  // Landed on the role's home area.
  await expect(page).toHaveURL(new RegExp(user.home))
}

/** Assert that an unauthenticated / unauthorized navigation lands back on login. */
export async function expectRedirectedToLogin(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login/)
}
