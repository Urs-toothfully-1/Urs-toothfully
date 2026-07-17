import { test as setup } from "@playwright/test"
import { existsSync, mkdirSync } from "node:fs"
import { login, USERS, RoleKey } from "./helpers"

/**
 * Authentication setup. Runs before the authenticated feature projects and
 * persists one storage-state file per role so tests start already logged in.
 */
const AUTH_DIR = "tests/e2e/.auth"
if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true })

for (const role of Object.keys(USERS) as RoleKey[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await login(page, role)
    await page.context().storageState({ path: `${AUTH_DIR}/${role}.json` })
  })
}
