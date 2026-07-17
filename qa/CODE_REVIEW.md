# Toothfully — Code Review

Senior-staff review of the Next.js 16 clinic-management app, organized into six structural
categories. Scope: authentication/authorization (`proxy.ts`, `lib/auth.ts`, `lib/session.ts`,
`server/services/auth.service.ts`), API routes (`app/api/**`), input validation, and supporting
libs (`lib/rate-limit.ts`, `lib/payment-guard.ts`, repositories/services).

**Overall this is a well-structured, security-conscious codebase** — layered
route → service → repository, Zod validation on writes, per-route `requireRole`, signed WhatsApp
webhooks, and a secret-gated cron endpoint. The findings below are mostly hardening
opportunities; two are worth fixing before wider rollout.

---

## ✅ Fixes applied (this session)

The following were fixed in source. Run `npx tsc --noEmit` + the Playwright suite on a normal
(non-sandboxed) checkout to confirm — the automated QA sandbox could not compile the edited files
(it couldn't sync file edits to its Linux mount, and lacks the Linux Prisma engine).

1. **Branch-scoped patient search** — `app/api/patients/route.ts` GET now passes
   `session.branchId` to `patientRepository.search` for non-admin roles (ADMIN still searches all
   branches). Closes the cross-branch PII leak.
2. **No more 401-masking** — the GET catch now returns 401 only for `UNAUTHORIZED`, 403 for
   `FORBIDDEN`, and **500 (logged)** for unexpected errors, matching the POST handler.
3. **Rate limiter counts all attempts** — `lib/rate-limit.ts` no longer filters on `success: true`,
   and `actions/intake.ts` + `actions/appointment-request.ts` now record failed (invalid/junk)
   submissions, so bot floods of invalid forms are throttled. Added a doc note on `x-forwarded-for`
   trust.
4. **DOB bounds** — both `createPatientSchema` (`patient.service.ts`) and the public intake schema
   (`actions/intake.ts`) now reject future dates and implausibly old years (>120y). The public
   schema previously only checked `min(1)`.
5. **Atomic queue claim** — `queue.repository.ts` gains `claimIfAvailable` (a single conditional
   `updateMany where status=WAITING, doctorId=null`), and `queue.service.ts` uses it instead of
   check-then-update, eliminating the double-claim race.

Regression tests added: future/ancient DOB (`tests/e2e/patients.spec.ts`) and a parallel
queue-claim race check (`tests/e2e/doctor.spec.ts`, gated on `E2E_WAITING_QUEUE_ID`).

Not changed (deliberately): the ~71 `any`/`as any` occurrences (a conventions cleanup, not bugs)
and the duplicate login paths (Server Action vs REST route — a design decision to make with the
team, not a defect).

---

## 1. Security

**Strengths**
- Passwords hashed with bcrypt; login is generic on failure (no user-enumeration — `auth.service.ts` returns `INVALID_CREDENTIALS` for both unknown email and bad password).
- Account lockout after 5 attempts for 15 min (`LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES`).
- JWT secret length enforced (≥32) in both `lib/session.ts` and `proxy.ts`; HS256 pinned in `proxy.ts` `jwtVerify(..., { algorithms: ["HS256"] })`, which correctly prevents `alg:none` downgrade.
- Session cookie is `httpOnly`, `sameSite=lax`, and `Secure` on Vercel/HTTPS.
- WhatsApp webhook verifies `x-hub-signature-256` before processing; cron requires a bearer secret and returns 503 if unset (fails closed).
- Patient name field blocks `<>` at the schema level (`patient.service.ts` regex `/^[^<>]+$/`), reducing stored-XSS surface.

**Findings**
- 🟠 **Medium — Patient search is not branch-scoped at the route.** `patient.repository.ts` supports an optional `branchId` filter (`search(query, page, branchId?)`), but `GET /api/patients` calls `patientRepository.search(q)` with no branch argument. Any authenticated staff member (e.g. a receptionist at one branch) can search **all** patients across every branch — a PII/data-isolation concern for a medical system. Pass `session.branchId` (with an explicit admin-wide override) into the search.
- 🟠 **Medium — Rate limiting counts only successful intakes and trusts `x-forwarded-for`.** `lib/rate-limit.ts` filters on `success: true`, so an attacker submitting invalid forms is never throttled; and `getClientIp` takes the first `x-forwarded-for` hop, which a client can spoof unless a trusted proxy overwrites it. Consider counting attempts regardless of outcome and deriving the IP from a trusted proxy header only.
- 🟡 **Minor — `/api/auth/login` is unauthenticated by design but has no rate limit of its own.** The account-lockout mitigates online brute force per-account, but there's no per-IP throttle on the login endpoint. Low risk given lockout, but worth an IP throttle for defense in depth.
- 🟡 **Minor — CSRF.** Auth relies on a `sameSite=lax` cookie, which covers most cross-site POST vectors, but state-changing `POST/DELETE` API routes have no explicit CSRF token. `lax` is generally sufficient here; note it as an accepted risk.

## 2. Error Handling

**Strengths**
- Services throw typed sentinels (`UNAUTHORIZED`, `FORBIDDEN`) that routes map to 401/403 (e.g. `app/api/patients/route.ts` POST).
- Cron endpoint isolates each sub-task in its own try/catch so one failure (reminders) doesn't abort the others (digest, queue) — good resilience design.
- Webhook always returns 200 after signature check to avoid Meta's aggressive retries, while still rejecting bad signatures with 401.

**Findings**
- 🟠 **Medium — Over-broad catch masks server errors as 401.** In `GET /api/patients`, `} catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }` swallows *any* exception — including a DB outage in `patientRepository.search` — and reports it as an auth failure. This hides real 500s from monitoring and misleads clients. Catch the auth sentinel specifically (as the POST handler does) and return 500 for unexpected errors.
- 🟡 **Minor — Silent failures.** `recordIntakeAttempt` swallows all errors (`catch {}`) by design ("never let bookkeeping break registration"). Reasonable, but emit a metric/log so persistent failures are observable.

## 3. Boundary & Edge Cases

**Strengths**
- `validatePaymentInput` (`lib/payment-guard.ts`) is exemplary: explicitly rejects `NaN`/`Infinity`/non-number (noting `"NaN <= 0"` is `false` and would slip past a naive guard), enforces `MAX_PAYMENT`, allows ₹0 only for consultations, and requires a reason + ADMIN role for adjustments.
- Zod bounds on patient input (name 2–200, mobile 10–15 digits, ISO date, gender enum).
- `proxy.ts` role matching is prefix-ordered most-specific-first with a `break`, so `/doctor/estimate` is evaluated before `/doctor`.

**Findings**
- 🟡 **Minor — DOB has no range floor/ceiling.** `z.string().date()` accepts any valid date, including future dates and implausible years (e.g. `1000-01-01`). Add `refine` bounds (not in the future, reasonable age range).
- 🟡 **Minor — Concurrency on queue claim.** `POST /api/queue/[queueId]/claim` should be verified to use an atomic conditional update (`updateMany where status = WAITING`) so two staff can't both claim the same entry. Worth a targeted test (see TC REC-003).
- 🟡 **Minor — Estimate money rounding.** Confirm line-item totals and advance % use integer minor units or a fixed 2-dp rounding strategy consistently to avoid drift (TC EST-011).

## 4. Performance & Memory

**Strengths**
- Prisma client is a singleton via `globalForPrisma` (`lib/prisma.ts`), preventing connection exhaustion under dev HMR.
- Rate-limit uses two `count` queries in `Promise.all` rather than loading rows.

**Findings**
- 🟡 **Minor — Verify report queries avoid N+1.** The reporting endpoints (`/api/reports/*`) aggregate across patients/payments; confirm they use Prisma aggregations/`groupBy` rather than per-row queries, especially monthly/outstanding over large ranges (TC ADM-011, NFR-007).
- 🟡 **Minor — Patient search `contains` with `mode: "insensitive"`** on `fullName`/`mobile`/`email`/`patientId` is a set of `ILIKE '%q%'` scans that won't use standard B-tree indexes. Fine at clinic scale; consider trigram (`pg_trgm`) indexes if the patient table grows large.

## 5. Testing Coverage Gaps

- No automated test suite existed beyond a single manual `e2e_test.mjs` script. **This review ships a 61-test Playwright suite** (`tests/e2e/`) plus a manual matrix (`qa/TEST_CASES.md`) covering the branches below.
- Highest-value gaps now covered by the new suite: RBAC guard table, login lockout/validation, patient-input boundaries, payment/estimate money guards, webhook signature & cron secret enforcement.
- Still uncovered / recommended next: unit tests for `validatePaymentInput` and `auth.service` lockout logic (fast, no browser); an integration test asserting **branch-scoped** patient search once finding #1 is fixed; queue-claim concurrency test with two parallel contexts.

## 6. Code Conventions

**Strengths**
- Consistent layering and file structure; `@/*` path alias; Prettier + ESLint (`next`) configured; no stray `console.log` in `app/`, `lib/`, or `server/`.
- Thoughtful inline comments explaining non-obvious decisions (cookie `Secure` logic, JWT trim, NaN guard).

**Findings**
- 🟡 **Minor — `any` / `as any` / eslint-disable appear ~71 times** across `app`, `lib`, `server`. Some are unavoidable at framework boundaries, but audit for places where a real type would catch bugs (especially around `formData`, webhook payloads, and Prisma JSON columns).
- 🟡 **Minor — Duplicate login paths.** Both a Server Action (`actions/auth.ts`) and a REST route (`app/api/auth/login/route.ts`) implement login with slightly different error contracts. Keep one as the source of truth (the Server Action drives the UI) and document the REST route's intended consumer, or consolidate.

---

## Verdict

### 🟢 APPROVED (pending a compile/test run on a normal checkout)

No critical vulnerabilities or data-loss bugs were found; the security fundamentals (hashing,
lockout, signed webhooks, JWT `alg` pinning, secret-gated cron, payment guard) are in good shape.
Both medium items — branch-scoped patient search and the 401-masking catch — plus the rate-limit,
DOB-bounds, and queue-claim-race findings **have now been fixed in source** (see "Fixes applied"
above). Regression tests were added.

Remaining, lower priority and left for the team: report N+1 verification, the `any` audit, and the
duplicate login-path consolidation. The new Playwright suite and manual matrix close the most
important prior gap — the app previously had almost no automated regression coverage.

**Before merging:** run `npx tsc --noEmit`, `npm run lint`, and `npm run test:e2e` on a normal
checkout (the QA sandbox couldn't compile the edits — no synced FS / no Linux Prisma engine).
