# Toothfully — Manual Test Case Matrix

Breadth-first QA coverage across all modules. Each module lists happy-path, boundary, negative, and edge cases.
Format: `Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result`.

**App under test:** Next.js 16 (App Router) dental clinic management system.
**Roles:** `ADMIN`, `DOCTOR`, `RECEPTIONIST`. **Session:** JWT cookie `toothfully_session`, 8h expiry.
**Seed logins:** `admin@toothfully.in / Admin@123`, `dr.jashwant@toothfully.in / Doctor@123`, `reception.outram@toothfully.in / Reception@123`.

---

## 0. Cross-cutting: Role-Based Access Control (RBAC)

Route guards live in `proxy.ts`. This matrix is the authoritative source of truth for authorization tests. `✓` = allowed, `✗` = denied (page → redirect, API → 401).

| Path prefix | ADMIN | DOCTOR | RECEPTIONIST | Public (no token) |
| :--- | :---: | :---: | :---: | :---: |
| `/login`, `/book`, `/intake` | ✓ | ✓ | ✓ | ✓ |
| `/admin/**` | ✓ | ✗ | ✗ | redirect `/login` |
| `/doctor` (root) | ✓ | ✓ | ✗ | redirect |
| `/doctor/estimate`, `/doctor/prescription` | ✓ | ✓ | ✓ | redirect |
| `/reception/**` | ✓ | ✗ | ✓ | redirect |
| `/appointments` | ✓ | ✓ | ✓ | redirect |
| `/whatsapp` | ✓ | ✗ | ✓ | redirect |
| `/whatsapp/settings` | ✓ | ✗ | ✗ | redirect |
| `/api/**` (non-public) | per-route `requireRole` | per-route | per-route | 401 JSON |
| `/api/whatsapp/webhook`, `/api/cron/daily` | public + own secret | — | — | own secret |

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RBAC-001 | proxy | Doctor blocked from admin area | Logged in as DOCTOR | 1. Navigate to `/admin/users` | Redirected to `/doctor` (own default route); no admin content rendered |
| RBAC-002 | proxy | Receptionist blocked from doctor consultation | Logged in as RECEPTIONIST | 1. Navigate to `/doctor/consultation` | Redirected to `/reception` |
| RBAC-003 | proxy | Reception allowed into estimate module | Logged in as RECEPTIONIST | 1. Navigate to `/doctor/estimate` | Page loads (estimate is shared with reception) |
| RBAC-004 | proxy | Unauthenticated page access | No session cookie | 1. Navigate to `/patients` | 302 redirect to `/login` |
| RBAC-005 | proxy | Unauthenticated API access | No session cookie | 1. `GET /api/patients?q=raj` | 401 JSON `{"error":"Unauthorized"}`, no data leaked |
| RBAC-006 | proxy | Expired/invalid token | Cookie set to malformed JWT | 1. Navigate to `/patients` | Redirect to `/login` AND `toothfully_session` cleared (maxAge 0) |
| RBAC-007 | proxy | Only whatsapp/settings is admin-only within whatsapp | Logged in as RECEPTIONIST | 1. Open `/whatsapp/queue` 2. Open `/whatsapp/settings` | Queue loads; settings redirects away |
| RBAC-008 | proxy | Most-specific prefix wins | Logged in as RECEPTIONIST | 1. Open `/doctor/estimate/new` | Allowed (matches `/doctor/estimate` before `/doctor`) |
| RBAC-009 | API authz | Cross-role API write blocked | Logged in as DOCTOR | 1. `POST /api/patients` with valid body | 403 Forbidden (create restricted to ADMIN/RECEPTIONIST) |
| RBAC-010 | proxy | Tampered role claim | Hand-craft JWT with role=ADMIN signed with wrong secret | 1. Set cookie 2. Open `/admin` | Signature check fails → redirect `/login`, cookie cleared |

---

## 1. Authentication & Session

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| AUTH-001 | LoginForm | Happy path — admin login | Seeded DB, on `/login` | 1. Enter `admin@toothfully.in` 2. Enter `Admin@123` 3. Click **Sign In** | Redirect to `/admin`; session cookie set (httpOnly, sameSite=lax) |
| AUTH-002 | LoginForm | Role-based landing | Valid doctor creds | 1. Login as doctor | Lands on `/doctor`; reception lands on `/reception` |
| AUTH-003 | LoginForm | Empty submit blocked (client) | On `/login` | 1. Click **Sign In** with both fields blank | Native `required` validation blocks submit; no network call |
| AUTH-004 | LoginForm | Invalid email format | On `/login` | 1. Type `not-an-email` 2. Tab out / submit | `type=email` validation prevents submit |
| AUTH-005 | authService | Wrong password | Valid email, bad password | 1. Submit | Error banner "Invalid email or password."; `loginAttempts` incremented |
| AUTH-006 | authService | Unknown email | Non-existent email | 1. Submit | Same generic "Invalid email or password." (no user-enumeration) |
| AUTH-007 | authService | Account lockout (boundary) | Same user, 4 prior failures | 1. Submit wrong password a 5th time 2. Submit correct password | 5th failure locks account; correct password now returns "Account temporarily locked … 15 minutes" |
| AUTH-008 | authService | Lockout auto-expiry | Account locked, wait 15 min | 1. After lockout window, submit correct password | Login succeeds; attempts reset to 0 |
| AUTH-009 | authService | Deactivated account | User `isActive=false` | 1. Submit correct creds | "This account has been deactivated. Contact your administrator." |
| AUTH-010 | Session | Password field masking + toggle | On `/login` | 1. Type password 2. Click eye icon 3. Click again | Toggles between masked/plain; `aria-label` updates |
| AUTH-011 | Session | Session persists across reload | Logged in | 1. Refresh dashboard | Still authenticated; no re-login |
| AUTH-012 | Session | Logout clears session | Logged in | 1. Trigger logout action | Cookie deleted; redirect `/login`; back-button to dashboard redirects to login |
| AUTH-013 | Session | Already-logged-in visits `/login` | Active session | 1. Navigate to `/login` | Auto-redirect to role default (no duplicate login) |
| AUTH-014 | Session | Boundary — email whitespace trim | Email with leading/trailing spaces | 1. `"  admin@toothfully.in  "` + valid password | Trimmed and authenticated |
| AUTH-015 | Session (edge) | Double-click Sign In | Valid creds, slow network | 1. Rapidly double-click **Sign In** | Button disables on pending; only one login processed (no double session) |
| AUTH-016 | Config (negative) | Missing/short JWT secret | `JWT_SECRET` < 32 chars | 1. Attempt login | Server rejects; `proxy` logs error and denies; no token minted |

---

## 2. Patient Registry (`/patients`, `/patients/new`, `/patients/[id]`)

Validation (`createPatientSchema`): fullName 2–200 chars & no `<>`; mobile 10–15 digits only; DOB ISO date; gender enum; email optional.

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| PAT-001 | New patient | Happy path create | Logged in as RECEPTIONIST | 1. Open `/patients/new` 2. Fill valid name/DOB/gender/10-digit mobile 3. Submit | 201; patient created with generated ID; redirect to profile |
| PAT-002 | Patient search | Search min length | Logged in | 1. `GET /api/patients?q=r` (1 char) | Returns `{patients: []}` — no query below 2 chars |
| PAT-003 | Patient search | Search returns matches | Seeded patients | 1. Search `q=raj` | Matching patients listed; results scoped/ordered sensibly |
| PAT-004 | New patient (boundary) | Name at min length (2) | On new form | 1. Name = `Al` + valid rest 2. Submit | Accepted |
| PAT-005 | New patient (boundary) | Name over max (201 chars) | On new form | 1. Paste 201-char name 2. Submit | 400 Validation failed on `fullName` |
| PAT-006 | New patient (negative) | Name with `<>` (XSS attempt) | On new form | 1. Name = `<script>x</script>` 2. Submit | 400 "Name contains invalid characters"; nothing stored/rendered |
| PAT-007 | New patient (boundary) | Mobile 9 digits (too short) | On new form | 1. Mobile = `123456789` 2. Submit | 400 on `mobile` (min 10) |
| PAT-008 | New patient (negative) | Mobile with letters/symbols | On new form | 1. Mobile = `98765-abcd` 2. Submit | 400 "Mobile must be digits only" |
| PAT-009 | New patient (negative) | Invalid DOB | On new form | 1. DOB = `2025-13-40` 2. Submit | 400 on `dateOfBirth` |
| PAT-010 | New patient (edge) | Future DOB | On new form | 1. DOB = tomorrow 2. Submit | Rejected or flagged (verify business rule; DOB should be in past) |
| PAT-011 | New patient (edge) | Duplicate detection | Existing patient same name+DOB | 1. Re-register same name+DOB | Soft warning shown; receptionist may proceed or cancel |
| PAT-012 | New patient (negative) | Invalid email format | On new form | 1. Email = `bad@` 2. Submit | 400 on `email` |
| PAT-013 | New patient (boundary) | Empty optional email | On new form | 1. Leave email blank | Accepted (email optional) |
| PAT-014 | Patient profile | Tabs load | Patient exists | 1. Open profile 2. Visit History/Documents/Payments/Estimates/Notes/Visits/Progress tabs | Each tab loads its data without error |
| PAT-015 | Patient profile (negative) | Non-existent patient ID | Logged in | 1. Open `/patients/does-not-exist` | 404 / not-found state, not a 500 |
| PAT-016 | Patient (authz) | Doctor cannot create patient | Logged in as DOCTOR | 1. `POST /api/patients` | 403 Forbidden |
| PAT-017 | Patient (edge) | Branch data isolation | Reception at Branch A | 1. Search patients | Verify whether results leak other branches' patients (data-isolation check) |
| PAT-018 | New patient (edge) | Double-submit registration | On new form | 1. Rapidly click Save twice | Only one patient created; no duplicate record |

---

## 3. Reception — Queue & Payments (`/reception`, `/reception/collect-payment`)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REC-001 | Queue | View today's queue | Logged in as RECEPTIONIST | 1. Open `/reception` | Queue entries for the branch/day listed with status |
| REC-002 | Queue | Add patient to queue (check-in) | Patient exists | 1. Check in patient 2. Select visit type | Queue entry created with `WAITING` status |
| REC-003 | Queue | Claim entry (concurrency) | Entry `WAITING` | 1. Two staff claim same entry near-simultaneously | Only one claim succeeds; other sees already-claimed |
| REC-004 | Collect payment | Happy path payment | Patient with outstanding balance | 1. Open collect-payment 2. Enter amount ≤ due 3. Select mode 4. Submit | Payment recorded; receipt generated; balance reduced |
| REC-005 | Collect payment (boundary) | Zero amount | On payment form | 1. Amount = 0 2. Submit | Rejected (amount must be > 0) |
| REC-006 | Collect payment (negative) | Negative amount | On payment form | 1. Amount = -100 | Rejected |
| REC-007 | Collect payment (boundary) | Overpayment | Balance = 500 | 1. Amount = 5000 2. Submit | Rejected or flagged per payment-guard rules |
| REC-008 | Collect payment (edge) | Double-submit payment | On payment form | 1. Rapidly submit twice | Single payment recorded; no duplicate receipt |
| REC-009 | Collect payment (negative) | Non-numeric amount | On payment form | 1. Amount = `abc` | Input validation blocks submit |
| REC-010 | Queue (authz) | Doctor blocked from reception | Logged in as DOCTOR | 1. Open `/reception` | Redirected away |

---

## 4. Doctor — Consultation & Treatment Session

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DOC-001 | Consultation | Open consultation for visit | Doctor logged in, visit in queue | 1. Open `/doctor/consultation/[visitId]` | Consultation workspace loads with patient context |
| DOC-002 | Clinical notes | Save clinical note | In consultation | 1. Enter examination note 2. Save | `POST /api/clinical-notes` succeeds; note persisted & timestamped |
| DOC-003 | Clinical notes (negative) | Save empty note | In consultation | 1. Save with empty body | Rejected / no-op with message |
| DOC-004 | Treatment session | Start session from queue | Queue entry claimed | 1. Open `/doctor/treatment-session/[queueId]` | Session loads; can record procedures |
| DOC-005 | Consultation (authz) | Reception blocked | Logged in as RECEPTIONIST | 1. Open `/doctor/consultation/x` | Redirected |
| DOC-006 | Consultation (edge) | Concurrent edit | Two doctors open same visit | 1. Both save notes | Last-write behavior is defined; no data corruption |
| DOC-007 | Signature | Capture doctor signature | Doctor logged in | 1. Open `/doctor/signature` 2. Draw & save | Signature stored and reused on documents |

---

## 5. Treatment Estimates (`/doctor/estimate`, wizard, edit)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| EST-001 | Estimate new | Create estimate | Logged in (doctor/reception/admin) | 1. `/doctor/estimate/new` 2. Add treatment items 3. Save | Estimate created in DRAFT with computed totals |
| EST-002 | Estimate wizard | Multi-step flow | Estimate started | 1. Walk wizard steps `/estimate/[id]/wizard` | State persists across steps; back/next preserve data |
| EST-003 | Estimate | Advance % default | Creating estimate | 1. Observe advance amount | Defaults to 20% (`DEFAULT_ADVANCE_PERCENT`) of total |
| EST-004 | Estimate (boundary) | Advance 0% and 100% | Editing estimate | 1. Set advance 0 2. Set advance 100 | Both accepted; balance recomputes correctly |
| EST-005 | Estimate (negative) | Advance > 100% | Editing estimate | 1. Set advance 150% | Rejected |
| EST-006 | Estimate items | Add/remove item recalculates | Estimate with items | 1. Add item 2. Delete item `DELETE /api/estimates/[id]/items/[itemId]` | Totals & advance recompute; no stale total |
| EST-007 | Estimate (boundary) | Zero-item estimate | New estimate | 1. Save with no items | Rejected or total = 0 handled gracefully |
| EST-008 | Estimate (edge) | Very large quantity/price | Editing item | 1. Qty = 99999, price = 9,999,999 | No overflow; currency formatting correct |
| EST-009 | Estimate | Status transitions | Draft estimate | 1. Move DRAFT→SENT/APPROVED per workflow | Only valid transitions allowed; invalid blocked |
| EST-010 | Estimate (negative) | Edit finalized estimate | Estimate APPROVED | 1. Attempt to edit items | Blocked (immutable after finalize) or produces revision |
| EST-011 | Estimate (edge) | Decimal rounding | Item price 33.335 ×3 | 1. Compute total | Rounding is consistent (2 dp) and total = sum of lines |
| EST-012 | Estimate print | Print/PDF view | Estimate exists | 1. Open `/print/estimate/[id]` | Print layout renders with clinic header/signature |

---

## 6. Prescriptions (`/doctor/prescription`)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RX-001 | Prescription new | Create prescription | Doctor logged in | 1. `/doctor/prescription/new` 2. Add drug/dosage/duration 3. Save | Prescription record created & linked to patient/visit |
| RX-002 | Prescription | Template reuse | Templates seeded | 1. Apply a prescription template | Fields pre-populate; editable before save |
| RX-003 | Prescription (negative) | No medications | New prescription | 1. Save empty | Rejected |
| RX-004 | Prescription (boundary) | Long dosage/notes | New prescription | 1. Enter max-length instructions | Saved without truncation error |
| RX-005 | Prescription print | Print view | Prescription exists | 1. `/print/prescription/[visitId]` | Renders with doctor signature & clinic details |
| RX-006 | Prescription (authz) | Reception can access module | Logged in as RECEPTIONIST | 1. Open `/doctor/prescription` | Allowed per RBAC |

---

## 7. Admin — Users, Treatments, Accounting, Reports, Audit, Settings

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ADM-001 | Users | Create staff user | Logged in as ADMIN | 1. `/admin/users` 2. Add user with role+branch 3. Save | User created; can log in with temp password |
| ADM-002 | Users (negative) | Duplicate email | Existing email | 1. Create user with same email | Rejected (unique constraint) |
| ADM-003 | Users | Deactivate user | Active user | 1. Toggle inactive | User can no longer log in (ACCOUNT_INACTIVE) |
| ADM-004 | Treatments | Manage treatment master | Logged in as ADMIN | 1. `/admin/treatments` 2. Add/edit treatment & price | Reflected in estimate item picker |
| ADM-005 | Accounting | Create accounting entry | Logged in as ADMIN | 1. `/admin/accounting` 2. Add entry | `POST /api/accounting` succeeds |
| ADM-006 | Accounting | Approve entry | Pending entry | 1. `POST /api/accounting/[id]/approve` | Status → approved; audit logged |
| ADM-007 | Accounting (authz) | Non-admin blocked | Logged in as RECEPTIONIST | 1. `POST /api/accounting` | 403 Forbidden |
| ADM-008 | Reports | Daily report | Data present | 1. `/admin/reports/daily` | Totals match underlying payments for the day |
| ADM-009 | Reports (boundary) | Empty date range | No data in range | 1. Select empty range | Report renders with zeros, not error |
| ADM-010 | Reports | Doctor / lead-source / monthly / outstanding / treatment | Data present | 1. Open each report | Each renders; numbers reconcile with source data |
| ADM-011 | Reports (edge) | Large date span perf | 1 year of data | 1. Run monthly report over 12 months | Returns within acceptable time; no timeout |
| ADM-012 | Audit | Audit log records sensitive actions | Perform a create/approve | 1. `/admin/audit` | Action, actor, timestamp captured |
| ADM-013 | Settings/Availability | Doctor availability edit | Logged in as ADMIN | 1. `/admin/availability` set slots | Saved; reflected in booking availability |
| ADM-014 | Tally export | Export accounting | Entries exist | 1. `/admin/tally` → export | `GET /api/tally/export` returns file in requested format |

---

## 8. Appointments & Public Booking (`/appointments`, `/book`, `/intake`)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| APT-001 | Appointments | View schedule | Logged in (any role) | 1. Open `/appointments` | Appointments listed by branch/date |
| APT-002 | Public booking | Happy path booking | Public (no login) | 1. Open `/book` 2. Pick slot + details 3. Submit | Appointment request created; confirmation shown |
| APT-003 | Public booking (negative) | Missing required fields | On `/book` | 1. Submit incomplete | Validation errors; no request created |
| APT-004 | Public intake | Rate limit — hourly (boundary) | Same IP, 3 prior successful | 1. Submit a 4th registration within the hour | Blocked: "Too many registrations from this device…" |
| APT-005 | Public intake | Rate limit — daily (boundary) | Same IP, 20 prior successful | 1. Submit 21st in a day | Blocked: daily limit message |
| APT-006 | Public intake (negative) | Failed attempts don't count | Same IP many *failed* submits | 1. Submit invalid forms repeatedly | NOTE: only successful attempts count — confirm this is intended (abuse risk) |
| APT-007 | Public intake (edge) | Turnstile bot check | Turnstile enabled | 1. Submit without solving challenge | Rejected when `TURNSTILE_SECRET_KEY` set; bypassed on LAN when empty |
| APT-008 | Appointment request | Admin approves request | Pending request | 1. Approve `/api/appointments`… | Status transitions; patient notified |

---

## 9. WhatsApp Module (`/whatsapp/*`, webhook, send)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| WA-001 | Templates | Create template | Logged in as ADMIN/RECEPTION | 1. `/whatsapp/templates` add template | Saved with category/status |
| WA-002 | Templates (negative) | Invalid variables | Template with bad placeholder | 1. Save | Validation error |
| WA-003 | Queue | View & drain queue | Messages queued | 1. `/whatsapp/queue` 2. Process | `POST /api/whatsapp/queue` drains retries |
| WA-004 | Send | Send message | Valid recipient+template | 1. `POST /api/whatsapp/send` | Message queued/sent; log entry created |
| WA-005 | Logs | View message logs | Messages exist | 1. `/whatsapp/logs` | Status (sent/delivered/read/failed) shown |
| WA-006 | Settings (authz) | Only admin | Logged in as RECEPTIONIST | 1. Open `/whatsapp/settings` | Redirected away |
| WA-007 | Webhook (security) | Missing/invalid signature | Public webhook | 1. `POST /api/whatsapp/webhook` no `x-hub-signature-256` | 401 Invalid signature; event not processed |
| WA-008 | Webhook (security) | Valid signature | Correct HMAC | 1. POST signed status event | 200 `{received:true}`; status updated |
| WA-009 | Webhook | Verification handshake | GET with hub params | 1. `GET /api/whatsapp/webhook?hub.mode=…` | Returns challenge on match, 403 otherwise |
| WA-010 | Webhook (edge) | Malformed JSON body | Valid signature, bad body | 1. POST invalid JSON | 400 Invalid JSON (no crash) |

---

## 10. Documents / Print / PDF & Cron

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DOCS-001 | PDF | Generate document PDF | Estimate/prescription/receipt exists | 1. `GET /api/documents/[type]/[id]/pdf` | Valid PDF returned with correct content-type |
| DOCS-002 | Print | Receipt print view | Receipt exists | 1. `/print/receipt/[receiptId]` | Renders printable receipt |
| DOCS-003 | PDF (negative) | Non-existent document | Logged in | 1. Request PDF for bad id | 404, not 500 |
| DOCS-004 | PDF (authz) | Unauthenticated | No session | 1. Request PDF | 401 |
| CRON-001 | Cron | Reject without secret | `CRON_SECRET` unset | 1. `GET /api/cron/daily` | 503 "Cron secret not configured" |
| CRON-002 | Cron (security) | Wrong bearer | Secret set | 1. GET with wrong `Authorization` | 401 Unauthorized |
| CRON-003 | Cron | Happy path | Correct bearer | 1. GET with `Bearer <secret>` | 200; reminders/digest/queue results returned; one failing sub-task doesn't abort others |

---

## 11. Non-functional & Resilience (spot checks)

| Test ID | Component | Scenario | Pre-conditions | Step-by-Step Actions | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| NFR-001 | Network | API failure handling | Throttle/kill network mid-action | 1. Submit a form during outage | User-facing error; no silent data loss; retry possible |
| NFR-002 | Session | Mid-session expiry | Session near 8h expiry | 1. Perform action after expiry | Redirect to login; unsaved work warning if applicable |
| NFR-003 | Responsiveness | Mobile viewport | 375px width | 1. Load login + key dashboards | Layout adapts (mobile logo shows; no horizontal scroll) |
| NFR-004 | Accessibility | Keyboard-only login | On `/login` | 1. Tab through fields, Enter to submit | All controls reachable; labels associated; eye toggle has aria-label |
| NFR-005 | Security | Cookie flags | Logged in over HTTPS | 1. Inspect session cookie | httpOnly, sameSite=lax, Secure on Vercel/HTTPS |
| NFR-006 | Security | Rate-limit IP spoofing | Behind proxy | 1. Vary `x-forwarded-for` per request | Confirm whether limit is trivially bypassed by spoofed IPs |
| NFR-007 | Performance | Report N+1 | Large dataset | 1. Run reports, watch query count | No pathological N+1 growth |
