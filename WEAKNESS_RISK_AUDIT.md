# Weakness and Future-Risk Audit

Date: 2026-05-21

This audit covers the three app surfaces in this repo:

- `backend`: Express API, Redis/Upstash storage, Odoo XML-RPC integration, cron monitor.
- `admin_app`: Next.js admin portal that talks to the backend admin API.
- `production-version`: Expo/React Native employee app.

No product-code fixes are included here. This is the risk register to use before planning owner-requested changes.

## Baseline Checks

| Area | Command | Result |
| --- | --- | --- |
| Backend tests | `npm.cmd test -- --runInBand` in `backend` | Failed: 7 suites failed, 15 tests failed, 320 passed. Main failures are auth tenant resolution and Odoo error status classification. |
| Backend build | `npm.cmd run build` in `backend` | Passed, but regenerated tracked `backend/dist` output. The generated changes were cleaned after the audit. |
| Mobile lint | `npm.cmd run lint` in `production-version` | Failed: 13 errors, 48 warnings. Errors include unescaped entities and missing display names; warnings include many hook dependency issues. |
| Admin install/build | `npm.cmd ci` and `npm.cmd install` in `admin_app` | Failed with npm TLS/certificate errors: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, then `Exit handler never called`. `next` was not installed, so `npm.cmd run build` cannot be trusted yet. |

## Highest-Priority Risk Register

### P0-1: Employees Can Act As Other Employees In The Same Tenant

**Evidence**

- The backend validates tenant from JWT, but most business routes trust `employee_id` from query/body:
  - `backend/src/routes/expenses.ts:52-64`, `backend/src/routes/expenses.ts:184-218`
  - `backend/src/routes/time_off.ts:77-99`, `backend/src/routes/time_off.ts:229-236`
  - `backend/src/routes/timesheet.ts:30-49`, `backend/src/routes/timesheet.ts:138-165`
  - `backend/src/routes/helpdesk.ts:149-169`, `backend/src/routes/helpdesk.ts:224-225`
  - similar patterns exist in attendance and maintenance routes.
- The mobile app passes `user.id` in API calls, but that is client-controlled traffic once it leaves the device: `production-version/api/client.ts:152-199`, `production-version/api/client.ts:222-327`.
- Notifications show the safer intended pattern by preferring `jwtPayload.id`: `backend/src/routes/notifications.ts:10-23`, `backend/src/routes/notifications.ts:50-58`.

**User impact**

An authenticated employee can read, create, or submit records for another employee in the same company if they know or guess the Odoo employee ID.

**Future-change risk**

Any owner-requested feature involving approvals, HR visibility, payroll, attendance, attachments, or request history can inherit this bug and become harder to fix later.

**Likely fix size**

Medium. Derive employee ID from JWT for employee routes. Add explicit admin-only endpoints if admin impersonation/querying is needed.

**Suggested tests**

- For every employee route, token `id=42` plus request `employee_id=999` must use/reject `999`.
- Create/update endpoints must ignore body `employee_id` unless the requester is an admin route.
- Keep existing tenant-isolation tests, but add employee-isolation tests.

### P0-2: Push Token Endpoints Are Public And Can Be Mutated Without A JWT

**Evidence**

- `/auth/*` routes are exempt from JWT middleware: `backend/src/index.ts:53-56`.
- `POST /auth/push-token` accepts tenant code, employee ID, and token, then writes directly: `backend/src/routes/auth.ts:149-156`.
- `DELETE /auth/push-token` accepts tenant code and employee ID, then removes directly: `backend/src/routes/auth.ts:171-183`.

**User impact**

Anyone with a company code can register or delete push tokens for any employee ID. This can break notifications, redirect notifications to another device, or poison device-count billing/limits.

**Future-change risk**

Owner changes around push notifications, employee limits, subscriptions, or billing will be built on unreliable device data.

**Likely fix size**

Small to medium. Require a valid employee JWT for push token create/delete and derive tenant/employee from that token. Keep only tenant lookup/login public.

**Suggested tests**

- Push token create/delete without JWT returns `401`.
- Body/query `employee_id` cannot override JWT employee ID.
- Old app compatibility path is either explicitly migrated or time-limited.

### P0-3: New Tenants May Have Employees With Empty Barcode/PIN, Blocking Login

**Evidence**

- Login depends on Odoo employee `barcode` and `pin`: `backend/src/routes/auth.ts:19-24`, `backend/src/routes/auth.ts:74-79`.
- The Odoo lookup specifically searches `hr.employee` by `barcode` and `pin`: `backend/src/odoo/client.ts:101-112`.
- New tenants may have real employees in Odoo whose `barcode` and/or `pin` are empty, so valid employees cannot authenticate through the app.
- Bulk-generating credentials for every employee is not appropriate because not every employee will use the app, and unused credentials increase support and security risk.

**User impact**

Employees for a newly onboarded tenant can be completely locked out even though their company has been added correctly. HR/admins will see this as an onboarding failure, not an auth edge case.

**Future-change risk**

Owner-requested onboarding, tenant rollout, employee self-service, or billing changes will be fragile until the app has a first-time employee activation model.

**Likely fix size**

Medium to large. Add a portal-owned employee activation flow instead of relying only on pre-existing Odoo `barcode + pin`.

**Suggested approach**

- Employee enters company code first.
- Employee identifies themselves using a verified Odoo field, preferably unique `work_email`.
- Backend resolves exactly one active `hr.employee` for that tenant.
- Backend sends a one-time activation code to the employee's verified email or phone.
- Employee enters the code and sets an app PIN/password.
- Backend stores portal credentials separately, mapped to `tenantId + employeeId`.
- Future login uses company code plus the portal credential.
- For employees without verified email/phone in Odoo, admin/HR should issue a single-use invite link, QR code, or activation code from the admin app.
- Do not identify employees by name alone, and do not let users claim arbitrary employee IDs without OTP/invite proof.

**Suggested tests**

- Employee with empty Odoo barcode/PIN can activate via verified email and then login.
- Duplicate email/identifier across employees fails safely and requires admin invite.
- Employee without verified contact cannot self-activate and requires admin-issued invite.
- Activation code is single-use, expires, and is tenant-scoped.
- Existing barcode/PIN login either remains supported during migration or is explicitly replaced with tested compatibility behavior.

### P1-3: Cron Endpoint Is Public If `CRON_SECRET` Is Missing, And It Fans Out Unbounded Work

**Evidence**

- The cron route only enforces auth when `process.env.CRON_SECRET` exists: `backend/src/routes/cron.ts:19-25`.
- It loads all push tokens and runs every monitor check concurrently: `backend/src/routes/cron.ts:27-41`.

**User impact**

If `CRON_SECRET` is absent in production, anyone can call `/cron/check-updates` and force Odoo/Redis work for every registered employee.

**Future-change risk**

This will get worse as tenants and employees grow. It can cause serverless timeouts, rate-limit issues, Odoo load, and noisy push behavior.

**Likely fix size**

Small for mandatory secret enforcement; medium for queueing/concurrency limits.

**Suggested tests**

- In production mode, missing `CRON_SECRET` fails closed.
- Bad/missing authorization always returns `401`.
- Cron processes tokens with bounded concurrency and reports partial failure safely.

### P1-4: Error Capture Middleware Is Registered Too Late To Capture Route Responses

**Evidence**

- The wrapper around `res.json` is added after all route handlers: `backend/src/index.ts:81-105`.
- Normal Express route handlers that send a response do not continue to later middleware unless they call `next()`.

**User impact**

The admin error log can miss the very errors it is supposed to collect. Operators may see a healthy admin panel while tenants are failing.

**Future-change risk**

Owner changes that depend on monitoring, support workflows, or health dashboards will be misleading.

**Likely fix size**

Small. Register the response wrapper before routes, or replace it with explicit centralized error logging.

**Suggested tests**

- Force a protected route to return `500`; assert `pushError` is called.
- Assert no duplicate logging for successful or handled `4xx` responses.

### P1-5: Odoo Client Cache Ignores Tenant Config Changes

**Evidence**

- Odoo XML-RPC clients are cached only by `tenantId`: `backend/src/odoo/client.ts:27-39`.
- The cached UID can live for one hour: `backend/src/odoo/client.ts:72-91`.
- Tenant edits save new Odoo credentials without clearing that cache: `backend/src/routes/auth.ts:281-304`.

**User impact**

After an admin changes Odoo URL/database/username/password, the backend can keep using stale clients and cached UIDs until process restart or cache expiry.

**Future-change risk**

Owner changes around onboarding, health checks, tenant editing, or credential rotation may appear broken or inconsistent.

**Likely fix size**

Medium. Add a config fingerprint to the cache key or expose cache invalidation on tenant save/delete.

**Suggested tests**

- First call uses old Odoo URL, tenant update changes URL, next call must create a new XML-RPC client.
- Failed auth must clear cached UID and not keep stale version metadata.

### P1-6: Tenant Storage And Subscription Number Generation Are Race-Prone

**Evidence**

- Tenant data is stored as one JSON blob under `shadow:tenants`: `backend/src/lib/tenantStore.ts:1-3`.
- New subscription numbers are generated by scanning all tenants and incrementing max: `backend/src/lib/tenantStore.ts:73-82`.
- Save/delete do read-modify-write of the whole blob: `backend/src/lib/tenantStore.ts:126-150`.

**User impact**

Concurrent admin actions can overwrite each other, lose tenant changes, or generate duplicate `SP-XXXXX` codes.

**Future-change risk**

Any owner-requested onboarding, billing automation, self-service signup, or multi-admin workflow will amplify this.

**Likely fix size**

Medium. Use Redis `INCR` for subscription numbers and Redis hashes or per-tenant keys for tenant records.

**Suggested tests**

- Simulate two concurrent tenant creates; assert unique subscription numbers.
- Simulate concurrent edits to different tenants; assert neither edit is lost.

### P1-7: Tenant Odoo Credentials Are Stored Plaintext In App-Level Redis

**Evidence**

- Tenant config includes `odoo_username` and `odoo_password`: `backend/src/lib/tenantStore.ts:9-12`.
- Tenant records are serialized directly to Redis JSON: `backend/src/lib/tenantStore.ts:136-140`.
- Env validation only requires strings, not strength, URL shape, or deployment-specific secrets: `backend/src/config.ts:6-14`.

**User impact**

An Upstash/app credential leak exposes every tenant's Odoo admin credentials.

**Future-change risk**

This becomes more dangerous with more tenants, billing/admin features, and support tooling.

**Likely fix size**

Medium to large. Encrypt tenant credentials with a managed key, move secrets to a secret manager, and use least-privileged Odoo service accounts.

**Suggested tests**

- Tenant list/detail never returns credentials.
- Stored tenant records do not contain raw Odoo passwords.
- Missing/weak JWT/admin/Redis secrets fail startup.

### P1-8: Odoo Error Classification Treats Too Many Unknown Errors As User-Fixable `422`

**Evidence**

- Any short clean message under 200 characters becomes `isBusinessRule: true`: `backend/src/odoo/parseError.ts:134-142`.
- `sendOdooError` turns `isBusinessRule` into status `422`: `backend/src/odoo/parseError.ts:160-166`.
- Backend tests currently fail because generic Odoo errors return `422` where tests expect `500`.

**User impact**

Real platform/Odoo outages can be presented as user mistakes, hiding incidents and confusing users.

**Future-change risk**

Owner-requested UX/error improvements will mask operational failures unless classification is tightened first.

**Likely fix size**

Small to medium. Only known Odoo business exceptions should become `422`; connectivity, RPC, database, and unknown errors should be `500/502`.

**Suggested tests**

- Known validation/user errors return `422`.
- Generic RPC, auth, timeout, DB, and connection errors return `5xx`.

### P2-9: Verification Baseline Is Red

**Evidence**

- Backend tests: 15 failures across auth, attendance, expenses, maintenance, time off, and timesheet.
- Mobile lint: 13 errors and 48 warnings.
- Admin app build cannot run because dependency installation is broken.

**User impact**

Changes can regress production behavior without a reliable signal.

**Future-change risk**

Owner-requested changes will take longer because failures are already mixed with new failures.

**Likely fix size**

Medium. Fix or intentionally update failing tests, then enforce backend tests and mobile lint before feature work.

**Suggested tests**

- Restore backend test green.
- Add an admin build check after dependencies install reliably.
- Decide whether mobile warnings are build-blocking or warning-only, then reduce hook warnings around navigation/data fetching.

### P2-10: Admin App Build/Install Path Is Broken Locally

**Evidence**

- `admin_app/node_modules/.bin/next.cmd` and `admin_app/node_modules/next/package.json` were absent after install attempts.
- `npm.cmd ci` and `npm.cmd install` failed on certificate validation and npm internal error.
- `admin_app/package-lock.json` expects `node_modules/next`, but it is not installed in the workspace.

**User impact**

Admin changes cannot be verified locally, and deployment install may fail depending on environment certificates.

**Future-change risk**

Owner changes to billing/admin/client management are high-risk until the admin build is reproducible.

**Likely fix size**

Small if it is only local certificate config; medium if lockfile/node/npm version compatibility is involved.

**Suggested tests**

- Fresh clone: `npm ci && npm run build` in `admin_app`.
- Document required Node/npm versions.

### P2-11: Mobile App Has Stale Closure And Routing Risks

**Evidence**

- Lint reports missing hook dependencies in root routing and app screens, including `production-version/app/_layout.tsx:43-73`.
- Root layout imports occur after executable code: `production-version/app/_layout.tsx:13-33`.
- Auth/session data is restored from AsyncStorage and stored as JSON/token directly: `production-version/providers/auth-context.tsx:55-82`, `production-version/providers/auth-context.tsx:154-170`.

**User impact**

Users may see stale data, missed refreshes, redirect weirdness, or inconsistent logout behavior. Local token storage is also weaker than secure native storage.

**Future-change risk**

Owner-requested navigation or workflow changes will be brittle while hook dependencies and auth restoration are noisy.

**Likely fix size**

Medium. Fix lint errors first, then audit hook warnings by screen.

**Suggested tests**

- Login/logout/token expiry after app restart.
- Navigation guard from login/onboarding/app routes.
- Dashboard/search refresh after user/tenant changes.

### P2-12: Attachment Handling Can Lose Files Or Overload Requests

**Evidence**

- Express JSON payload limit is global `20mb`: `backend/src/index.ts:20-23`.
- Backend validates max 3 attachments but not per-file byte size or MIME allowlist.
- Mobile converts images to base64 without checking size: `production-version/components/AttachmentPicker.tsx:33-60`.
- Odoo attachment upload failures are caught and only logged: `backend/src/odoo/client.ts:232-243`.

**User impact**

Requests can succeed while attachments silently fail, or large images can hit serverless/body limits.

**Future-change risk**

Owner changes involving receipts, documents, HR proof, or audit trails need reliable attachment semantics.

**Likely fix size**

Medium. Enforce per-file and total limits, compress/resize images, return partial upload failures explicitly, and add MIME validation.

**Suggested tests**

- Oversized attachment returns clear `413/400`.
- Odoo attachment failure returns visible warning/failure.
- Valid three-image upload succeeds under limit.

### P2-13: Deployment And Environment Configuration Are Confusing

**Evidence**

- Root `vercel.json` points to `src/index.ts`, which does not exist at repo root.
- `backend/vercel.json` points to `src/index.ts`, which exists under `backend`.
- Mobile hardcodes production API URL: `production-version/constants.ts:1`.
- `backend/.env.example` lists old single-tenant Odoo vars and omits required `ADMIN_SECRET`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.

**User impact**

New environments are easy to misdeploy or misconfigure.

**Future-change risk**

Owner-requested release/deployment changes may fail in ways that look like app bugs.

**Likely fix size**

Small to medium. Remove or fix root Vercel config, update env examples, and make mobile API URL environment-driven.

**Suggested tests**

- Fresh environment config checklist.
- Production/staging mobile builds use different API URLs.

### P3-14: Repo Hygiene Shows AI-Generated Drift

**Evidence**

- `backend/dist` is committed while source TypeScript is also present.
- `graphify-out` references `backend/dist` as source for important nodes, so generated code is influencing architecture documentation.
- `admin_app/README.md` is still create-next-app boilerplate.
- `production-version/README.md` is still BNA UI boilerplate.
- Several source files contain mojibake/corrupted characters in comments/log strings.

**User impact**

New contributors and future agents can read the wrong thing, change generated files, or trust stale documentation.

**Future-change risk**

Owner requests will be slower because the codebase does not clearly separate source, generated artifacts, docs, and tests.

**Likely fix size**

Small. Update `.gitignore`, stop tracking generated output if deployment allows, regenerate graph/docs from source, and replace template docs with real runbooks.

**Suggested tests**

- CI verifies no generated `dist` drift after build.
- Documentation points to source files, not compiled JS.

## Recommended Order Before Owner Changes

1. Fix P0 employee authorization, public push-token mutation, and first-time employee activation for empty Odoo barcode/PIN.
2. Make cron fail closed and move/fix backend error logging.
3. Fix stale Odoo client caching and tenant storage races.
4. Restore the verification baseline: backend tests green, mobile lint green or intentionally scoped, admin install/build reproducible.
5. Update deployment/env docs so future changes can be tested in a clean environment.

## Owner-Change Planning Rule

For every upcoming owner-requested change, classify it against this audit first:

- If it touches employee records, requests, notifications, attendance, expenses, helpdesk, maintenance, or timesheets, require the P0 employee authorization fix first.
- If it touches onboarding, login, tenant rollout, or employee access, require the first-time activation/invite design first.
- If it touches admin onboarding, billing, tenant edits, Odoo credentials, or health checks, require the Odoo cache and tenant storage fixes first.
- If it touches push notifications, cron, reminders, or status monitoring, require authenticated push-token handling and bounded cron first.
- If it touches release/deployment, require admin build repair and environment cleanup first.
