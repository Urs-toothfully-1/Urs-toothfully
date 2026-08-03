# QA harness

Two layers, both meant to run against a **throwaway database** — never `.env`
(that points at production Supabase).

## 1. Deep workflow simulation — `deep-journey.ts`

Six months in the life of one patient, driven through the real service layer:
registration → consultation fee → queue → prescription (diagnosis, custom
treatment, multi-tooth) → estimate → agreement → advance → three RCT sittings
across months → instalments → return visit with a fresh consultation and
estimate → carry-over, appointments, profile correction, soft delete, and money
integrity. 61 assertions.

```bash
createdb toothfully_deeptest        # or: psql -c "CREATE DATABASE toothfully_deeptest;"
export DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/toothfully_deeptest
export DIRECT_URL=$DATABASE_URL
npx prisma migrate deploy && npx prisma db seed
TS_NODE_PROJECT=qa/tsconfig.qa.json \
  npx ts-node --transpile-only -r tsconfig-paths/register qa/deep-journey.ts
```

Re-seed between runs — the script creates a patient each time and some
assertions count rows.

## 2. UI regression — `tests/e2e/journey-ui.spec.ts`

Drives the same workflows through a browser: profile edit/delete, queue
completion, the consultation wizard with a custom treatment, the tooth picker,
treatment-master editing, adding several users in a row, the print templates,
plus a smoke pass over every route for all three roles.

Run the app against the same throwaway database (a production build — `next dev`
compiles too slowly for the login timeouts), then:

```bash
E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.qa.config.ts
```

The existing per-role suite still runs from `playwright.config.ts`; use
`--workers=2` locally, since a single Next server prefetches every sidebar route
and full parallelism makes logins time out.

## 3. Pure-logic self-check — `scripts/check-fixes.mjs`

No database, no framework: `node scripts/check-fixes.mjs`.
