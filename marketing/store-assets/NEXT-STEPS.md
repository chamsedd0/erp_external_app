# What to do next, now that you have the D-U-N-S number

This picks up where the root `STORE_SUBMISSION.md` playbook leaves off. That file still holds the build commands, the privacy-label answers and the demo-tenant steps; this one covers what changed since it was written (the rename, the 2026 store rules) and the order to do things in. Store rules below were read from Apple's and Google's own pages on 6 Oct 2026.

## 1. Open both developer accounts (this is what the D-U-N-S unlocks)

Both run in parallel and both can take days, so start them first.

**Apple Developer Program, as an organization** ($99 a year, enrolment on the web only)

- The legal entity name must match the D-U-N-S record exactly. That legal name is what the App Store shows as the seller, so it is where "by Octagon9" comes from.
- The person enrolling needs authority to sign for the company, or a reference who can confirm it.
- A work email on the company's own domain. A Gmail address is not accepted.
- A public, working company website on that same domain.
- Apple verifies, then emails the next step. Apple may ask for notarised company documents.
- If Apple's form doesn't find a freshly issued number, wait a few days and try again; its lookup is fed by Dun & Bradstreet.

**Google Play Console, as an organization** ($25 once)

- D-U-N-S number, organization website and phone.
- The organization name and address in the Google Payments profile must match the Dun & Bradstreet record.
- Contact email and phone are verified by one-time code.
- The developer email and phone are shown publicly on Google Play, along with the legal name and address. Use a company inbox and number.
- An organization account is not subject to the 12-testers-for-14-days closed test that new personal accounts must run.

**For Europe:** Apple asks for trader status under the Digital Services Act before an app can be distributed in the EU. Octagon9 sells to businesses, so declare it as a trader; the address, phone and email you give are shown on the product page in the EU.

## 2. Do the rename before the first build is uploaded

The bundle ID and Android package name can never be changed after the first release, so this has to happen now.

| Where | Now | Change to |
|---|---|---|
| `production-version/app.json` → `name` | Shadow Portal | Shadow |
| `app.json` → iOS `bundleIdentifier`, Android `package` | `com.chams3445.shadowportal` | the company's reverse domain, for example `com.octagon9.shadow` |
| `app.json` → camera and photo permission texts | "Allow Shadow Portal to…" | "Allow Shadow to…" |
| `app.json` → `slug`, `scheme`, `owner` | `shadow-portal`, personal Expo account | decide whether to move to a company Expo organization |
| `production-version/app/(app)/settings.tsx` (2 places) | "Shadow Portal" | "Shadow" |
| `backend/src/routes/legal.ts` (privacy, terms, delete-account) | "Shadow Portal", contact `lhouijchams@gmail.com` | "Shadow", the legal entity name, a company-domain address |
| `backend/src/routes/auth.ts`, `lib/invoiceTemplate.ts` | emails and quotes say Shadow Portal | Shadow |
| Firebase Android app + `google-services.json` | package `com.chams3445.shadowportal` | recreate for the new package |
| Legal page host | `erp-external-app.vercel.app` | the company domain (both stores publish this URL) |

On the store name itself: "Shadow" alone is probably taken on the App Store, where names must be unique. Fallbacks are in `STORE-LISTING.md`.

## 3. Two small app fixes found while making the screenshots

These are in the app today, so real screenshots would show them.

- **Company Setup and Sign In, light mode.** The button label is hard-coded dark (`#1a1a1a`) on the blue primary button, which is hard to read. It is correct in dark mode. Use the theme's `primaryForeground` instead. (`production-version/app/login.tsx`)
- **New Request, Attendance card.** On a 390-pt phone the subtitle "Fix a missed check-in or check-out" runs underneath the arrow button. Give the text block right padding. (`production-version/app/(app)/new-request.tsx`)

## 4. Review access

Unchanged from the playbook, and still the most common cause of rejection for a sign-in-only app: a demo tenant that stays online for the whole review, with the company code, employee ID and PIN written into Apple's App Review notes and Google's App access form.

## 5. Listing assets: what exists and what each store needs

| Asset | Apple | Google Play | Status |
|---|---|---|---|
| iPhone screenshots | Required. 1–10 per size, PNG or JPEG, no alpha. Apple's page lists the 6.3-inch display (1206×2622 or 1179×2556) as the required size; the 6.9-inch (1320×2868) is the largest and is scaled down for the rest | — | Done: 5 at each size, in `ios/` |
| Phone screenshots | — | Required. At least 2; at least 4 at 1080×1920 or larger to be eligible for promotion. PNG or JPEG, no alpha, longest side at most twice the shortest | Done: 5 in `android/phone-1080x1920/` |
| Feature graphic | — | Required. 1024×500, no alpha | Done |
| Icon | Comes from the build (1024×1024, no transparency) | 512×512 PNG, under 1024 KB | Done, in `icons/`. The app's `icon.png` is fully opaque, so it passes |
| Video | Optional "app preview": 15–30 s, 886×1920, 30 fps, real in-app capture only | Optional: a YouTube link. Portrait is accepted. The first 30 s autoplay, muted. Ads off, public or unlisted, not age-restricted, embeddable | The 37 s explainer is made for Google Play, the website and social. It does not qualify as an Apple app preview; skip that for version 1.0 |
| iPad or tablet screenshots | Not needed (`supportsTablet` is false) | Optional | — |
| Text | Name, subtitle, keywords, description, promotional text | Short and full description | Drafted in `STORE-LISTING.md` |
| Forms | Age rating (the new 2026 questionnaire), privacy labels, export compliance | Data safety, content rating, target audience, ads declaration, app access | Answers for privacy and data safety are in the playbook §4–5 |

The screenshots are built from source reconstructions of the app's screens with a synthetic employee. To publish real captures instead, see `README.md` in this folder.

## 6. Build requirements to confirm on the next build

- **Apple:** uploads must be built with Xcode 26 and the iOS 26 SDK (since 28 April 2026). Expo SDK 54 supports this; check that the EAS build image is an Xcode 26 one.
- **Google:** new apps must target Android 16, API level 36 (since 31 August 2026). Check `targetSdkVersion` in the production build.

## 7. Order

1. Enrol with Apple and Google today.
2. While they verify: rename, fix the two UI items, set up the demo tenant and Firebase for the new package.
3. Production builds; test on real devices (playbook §3).
4. Create the app records, paste the listing text, upload the screenshots and feature graphic, add the YouTube link on Play.
5. TestFlight and Play internal testing, then submit iOS first.
