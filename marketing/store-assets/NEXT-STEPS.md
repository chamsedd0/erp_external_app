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

## 2. Rename (done in the code on 30 Oct 2026, not yet deployed)

Decided by the developer: the package name and bundle ID stay `com.chams3445.shadowportal`, so nothing about signing or the Expo project changes. Firebase is set up: `production-version/google-services.json` (gitignored, but uploaded to EAS builds) and the FCM V1 key is assigned in Expo. **Still to do: upgrade Vercel to Pro and add the 15-minute cron for `/cron/check-updates` to `vercel.json`. No schedule exists today, so notifications don't arrive while the app is closed.** The IDs can't be changed after the first upload, and stores don't show them prominently, but they are visible in the Play URL.

| Item | Value |
|---|---|
| App name | Shadow |
| Legal entity (from the commercial registration) | OCTAGON NINE W.L.L, Bahrain |
| Company domain | octagonnine.com |
| Public contact email | lhouijchams@gmail.com |
| Backend and legal pages | `https://api.octagonnine.com` (Vercel, connected 30 Oct 2026) |

Changed: app name and permission texts (`app.json`), Settings, the legal pages, the account-deletion email, the quotation template. `slug`, `scheme` and the Expo `owner` are unchanged on purpose; they aren't shown to users and the slug is tied to the EAS project. The admin web app still says "Shadow Portal"; employees and stores never see it.

On the store name: "Shadow" alone is probably taken on the App Store, where names must be unique. Fallbacks are in `STORE-LISTING.md`.

## 3. Two small app fixes (done in the code on 30 Oct 2026)

- **Company Setup and Sign In:** the button label now uses the theme's `primaryForeground`, so it is readable in light mode.
- **New Request, Attendance card:** the subtitle no longer runs under the arrow button.

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
