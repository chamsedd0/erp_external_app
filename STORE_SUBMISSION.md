# Shadow Portal — App Store & Play Store Submission Playbook

Goal: **first-try approval on both stores.** Everything code-side is already done
(see "Already done in the repo" at the bottom). This file is the manual work, in order.

---

## 0. Developer accounts — START TODAY (longest lead time)

**Recommendation: enroll as an ORGANIZATION on both stores** (the app is published by a business):

| | Apple | Google |
|---|---|---|
| Cost | $99/year | $25 one-time |
| Enrollment | developer.apple.com/programs/enroll — **organization requires a D-U-N-S number** (free; check if the company has one at Apple's D-U-N-S lookup tool first; obtaining a new one can take days–weeks) | play.google.com/console/signup — organization requires business verification (docs + website/email on company domain) |
| Why organization | App is listed under the company name; needed for the B2B SaaS positioning | **Personal accounts must run a 14-day closed test with 12 testers before ANY production release** — organization accounts skip this entirely |
| Fallback if speed is critical | Individual enrollment (approves in ~1–2 days, publishes under a personal name; app can be transferred to an org account later) | Avoid personal if at all possible — the 14-day test requirement is a hard 2-week delay |

While enrollment processes, do sections 1–3 in parallel.

---

## 1. Demo tenant for reviewers (Apple AND Google will need it)

The app is credential-gated with no demo mode, so reviewers **must** get working credentials.
This is a top-3 rejection cause — treat it as production infrastructure.

1. Use your demo Odoo instance. It must stay **online 24/7 for the entire review window** (Apple reviews can stretch over days and happen at any hour).
2. Register it as a tenant via the admin API (`POST /admin/tenants` with `x-admin-secret`) or the admin app. Give it an obvious name, e.g. slug `demo` / name "Shadow Portal Demo Co".
3. Create a demo employee in the demo Odoo (with department, job title, a few existing time-off requests/expenses so screens aren't empty; add allocations so the leave balance shows).
4. Create an invite/activation for that employee and set a PIN. Record:
   - **Company code:** `____________`
   - **Employee ID:** `____________`
   - **PIN:** `____________`
5. **The night before each submission**: sign in with exactly these credentials on a real device and touch every feature (time off incl. balance + attachments, expense, helpdesk, notifications). Re-verify daily while the review is open.

---

## 2. Firebase / FCM V1 — required for Android push

Without this, push notifications silently fail on production Android builds.

1. console.firebase.google.com → create project "Shadow Portal".
2. Add an **Android app** with package name `com.chams3445.shadowportal`.
3. Download `google-services.json` → put it in `production-version/` (it's gitignored).
4. In `production-version/app.json`, add under `"android"`: `"googleServicesFile": "./google-services.json"`.
5. Firebase → Project settings → Service accounts → **Generate new private key** (JSON).
6. `cd production-version && eas credentials` → Android → Google Service Account → upload that key for **FCM V1**.

iOS push needs nothing extra: the first production build generates the APNs key via EAS, and the app uses Expo's push service.

---

## 3. Builds

```bash
cd production-version
npx expo-doctor                      # must be clean
eas build --profile preview -p android   # apk for device testing
eas build --profile preview -p ios       # adhoc for device testing
```

Device test checklist (real devices, both platforms):
- [ ] All three auth flows: employee ID + PIN, work-email OTP, invite code
- [ ] Company Setup with the demo tenant code
- [ ] Time off: leave type balance appears, live "≈ N days" count, photo attachment, submit
- [ ] Expense / helpdesk / maintenance / attendance submissions
- [ ] Push notification received end-to-end **on the Android build** (validates FCM V1)
- [ ] Settings: Privacy Policy + Terms open, **Delete Account works end-to-end** (after deletion: login rejected until re-invited; verify Redis keys removed)
- [ ] Dark mode + Arabic (RTL) don't break layouts
- [ ] Airplane mode: no crashes, sane error messages
- [ ] Notification icon in the status bar is the portal glyph, not a white square

Then production builds:
```bash
eas build --profile production -p ios
eas build --profile production -p android
```

---

## 4. App Store Connect (Apple)

1. Create the app record: bundle ID `com.chams3445.shadowportal`, name "Shadow Portal",
   category **Business**. Copy the Apple ID of the app into `eas.json` → `submit.production.ios.ascAppId`, and your Team ID into `appleTeamId`.
2. **Privacy policy URL:** `https://erp-external-app.vercel.app/legal/privacy`
3. **Privacy nutrition labels** (App Privacy section) — declare exactly this, nothing more:
   - Contact Info → Name, Email Address — linked to identity, app functionality
   - Identifiers → User ID (employee ID) — linked to identity, app functionality
   - User Content → Photos or Videos (attachments), Other User Content (requests) — linked to identity, app functionality
   - **Data used for tracking: NO** (there are no analytics/ads SDKs). No ATT prompt needed.
4. **App Review Information** — this is the 3.2(b) defense; use this text (adapt as needed):
   > Shadow Portal is a multi-tenant B2B SaaS employee self-service portal, comparable to
   > Odoo, Workday, or BambooHR mobile apps. It is NOT an internal app for a single company:
   > any company running the Odoo ERP can subscribe, receive a company code, and onboard its
   > employees through the public Company Setup screen. Each company's employees sign in with
   > that company code plus their personal credentials.
   >
   > Demo access for review:
   > Company code: [from section 1]  ·  Employee ID: [...]  ·  PIN: [...]
   > Sign-in flow: open app → enter company code → enter employee ID and PIN.
5. **Screenshots** (6.7" iPhone required set; app is iPhone-only so no iPad set needed).
   Take from the real app on a 6.7"/6.9" simulator or device: login/company setup, dashboard,
   New Time Off (showing the balance + day count), request details, notifications, settings.
   No device frames with wrong content, no marketing collage that misrepresents screens.
6. Export compliance: already answered in the binary (`ITSAppUsesNonExemptEncryption: false`) — no prompt.
7. Submit:
```bash
eas submit -p ios --latest
```
   TestFlight-test the exact build before pressing "Submit for Review".

---

## 5. Google Play Console

1. Create the app (name "Shadow Portal", app type App, free).
2. **Store listing:** short + full description (emphasize multi-company B2B nature), icon is
   pulled from the AAB, phone screenshots (same set as Apple), feature graphic 1024×500.
3. **Privacy policy URL:** `https://erp-external-app.vercel.app/legal/privacy`
4. **Data safety form** — declare exactly:
   - Personal info → Name, Email address: collected, encrypted in transit, **not shared**, deletable
   - Photos and videos → Photos: collected (user-initiated attachments), not shared, deletable
   - App activity → Other user-generated content (requests): collected, not shared, deletable
   - Device or other IDs → Device or other IDs (Expo push token): collected, not shared, deletable
   - Data is processed to provide app functionality on behalf of the user's employer; no ads, no analytics, no data sold.
   - Account deletion: **yes, in-app** + URL: `https://erp-external-app.vercel.app/legal/delete-account`
5. **App content declarations:** privacy policy set; not child-directed (target 18+/business);
   no ads; **App access → provide the demo credentials** (all of: company code, employee ID, PIN, with the sign-in steps from section 4.4).
6. Release path: **Internal testing first** → install from Play, verify → review the
   **pre-launch report** (crashes on real devices, accessibility warnings) → promote to Production.
```bash
eas submit -p android --latest    # goes to the internal track per eas.json
```

---

## 6. Submission order & watch items

1. Submit **iOS first** (reviews are slower and stricter); fix anything they flag, then Android.
2. Keep the demo Odoo up and re-verify credentials **daily** during review.
3. If Apple rejects with **3.2(b)** ("designed for a specific business"): reply in Resolution
   Center with the multi-tenant argument (any company can subscribe; public onboarding;
   comparable to Odoo/Workday apps on the store) — do not resubmit silently.
4. If Apple asks how accounts are created (since there's no public sign-up): explain accounts
   are provisioned by each subscribing company's HR (invite/OTP activation), which is standard
   for B2B SaaS (same as Workday/Slack Enterprise), and point at the demo credentials.

## Top risks, ranked

1. **No developer accounts yet** — D-U-N-S / verification is the schedule driver. Start section 0 now.
2. **Apple 3.2(b)** single-company perception — mitigated by review notes (section 4.4).
3. **Demo credentials failing mid-review** — section 1.5 daily check.
4. **Privacy label ↔ Data-safety ↔ policy mismatch** — sections 4.3 and 5.4 are both derived from the same inventory as `/legal/privacy`; if the app starts collecting something new, update all three together.
5. **Android push broken** — caught by section 3 device testing (FCM V1).

---

## Already done in the repo (this session)

- `app.json`: iOS `bundleIdentifier` + `supportsTablet: false` + `ITSAppUsesNonExemptEncryption`, proper `adaptive-icon.png` + `monochrome-icon.png`, white-glyph `notification-icon.png`
- `eas.json`: remote versioning, production `autoIncrement`, submit profiles (fill in `ascAppId`/`appleTeamId` after section 4.1)
- Removed orphaned BNA template screens (`app/(tabs)/`, `sheet.tsx`)
- Android notification channel registered at startup
- Hosted legal pages: `/legal/privacy`, `/legal/terms`, `/legal/delete-account` (public, no JWT)
- In-app Privacy Policy + Terms links and **Delete Account** (Settings), backed by `DELETE /auth/account` which wipes credential, push token, registration, request cache, and notification history, then emails HR
- Time-off form: leave balance display + live day count (also part of the demo-review story)
- Store credential files gitignored (`play-service-account.json`, `google-services.json`)
