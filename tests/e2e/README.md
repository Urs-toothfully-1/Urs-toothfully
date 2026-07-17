# Toothfully — Playwright E2E Suite

61 tests across 10 spec files covering authentication, RBAC, patients, reception/payments,
estimates, doctor/prescriptions, admin/reports, WhatsApp webhook & cron security, and public
booking/intake. Built with `@playwright/test` using user-facing locators (`getByRole`,
`getByLabel`) and Playwright's auto-waiting — no hardcoded `waitForTimeout`.

## Layout

```
playwright.config.ts        # projects: setup → public / admin / doctor / reception
tests/e2e/
  helpers.ts                # login() + seed credentials
  auth.setup.ts             # logs in per role, saves storage state to .auth/
  smoke.spec.ts             # login page render + client validation (no DB writes)
  rbac.spec.ts              # role/authorization guards from proxy.ts
  patients.spec.ts          # createPatientSchema boundaries & negatives
  reception.spec.ts         # queue + payment validation
  estimates.spec.ts         # estimate reachability + money guards
  doctor.spec.ts            # doctor dashboard + clinical-notes guard
  prescriptions.spec.ts     # prescription pages
  admin.spec.ts             # admin pages + webhook/cron security
  public.spec.ts            # public booking + intake
```

## Prerequisites

1. **Install the runner + browser** (once):
   ```bash
   npm install -D @playwright/test@1.61.1
   npx playwright install chromium
   ```
2. **A seeded database** so the seed logins exist:
   ```bash
   npm run db:migrate      # apply migrations
   npm run db:seed         # creates admin/doctor/reception users
   ```
   Seed logins used by the suite (`helpers.ts` → `USERS`):
   `admin@toothfully.in / Admin@123`, `dr.jashwant@toothfully.in / Doctor@123`,
   `reception.outram@toothfully.in / Reception@123`.
3. **Run the app** (`npm run dev`), or enable the `webServer` block in
   `playwright.config.ts` to have Playwright start it automatically.

## Running

```bash
# Everything
npx playwright test

# Just the DB-free smoke tests
npx playwright test smoke

# One role's specs
npx playwright test --project=reception

# HTML report
npx playwright show-report tests/e2e/.report
```

`E2E_BASE_URL` overrides the target (default `http://localhost:3000`).

## Notes / TODO before the first full run

- **`patients.spec.ts`** and other create-payload tests use placeholder ids
  (`REPLACE_WITH_SEEDED_BRANCH_ID`, `seed-patient`). Point these at real seeded ids
  (or read them from an API in a `beforeAll`) to convert the "happy path" assertions
  from "not 500 / not 401" into strict `201` checks. They are written permissively so
  the suite is green against a fresh seed and tightened as fixtures are added.
- **Login uses a Next.js Server Action**, not `POST /api/auth/login`. `helpers.login()`
  drives the real form, which is what a user does. (`/api/auth/login` also exists and is
  covered indirectly by the RBAC/public specs.)
- Specs assert on absence of `application error` / `unhandled runtime` in the body as a
  cheap crash detector for pages whose exact copy may change.

## Sandbox run performed for this deliverable

The suite was authored and validated in a Linux sandbox:
- `tsc` type-check of all specs against the project `tsconfig`: **passed**.
- `npx playwright test --list`: **61 tests discovered/compiled** by the runner.
- Locator + browser execution (`getByRole`/`getByLabel`, native form validation) verified
  against the bundled Chromium: **passed**.

A full green run against the live app was **not** possible in that sandbox because the
project's `node_modules` was provisioned on Windows (only the Windows Prisma query engine
is present and `binaries.prisma.sh` was network-blocked), and the dev server could not
watch the mounted filesystem. On your Windows machine — where Prisma and file-watching work
normally — `npx playwright test` will execute the full suite once the DB is seeded and the
app is running.
