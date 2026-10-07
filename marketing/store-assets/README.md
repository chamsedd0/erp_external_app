# Store assets — Shadow by Octagon9

Everything the App Store and Google Play listings need besides the build itself.

| Folder / file | What it is |
|---|---|
| `ios/iphone-6.9-inch-1320x2868/` | 5 App Store screenshots for the large iPhone display |
| `ios/iphone-6.3-inch-1206x2622/` | The same 5 at the size Apple lists as required |
| `android/phone-1080x1920/` | 5 Google Play phone screenshots (9:16) |
| `android/feature-graphic-1024x500.png` | Google Play feature graphic |
| `icons/` | 512 px Play icon and a 1024 px no-alpha App Store icon, both from the app's own icon |
| `captures/` | Empty. Drop real device screenshots here (see below) |
| `overview-not-for-upload.png` | All five screenshots and the feature graphic on one sheet, for sharing with the client. Not a store asset |
| `STORE-LISTING.md` | Name options, subtitle, keywords, descriptions, review notes |
| `NEXT-STEPS.md` | What to do now that the D-U-N-S number exists |

The explainer video is in `../explainer-v3/out/`.

## What the screenshots are made from

The screens are rebuilt in HTML from the app's own source (`production-version/`), with a synthetic employee, Yasmine Alaoui. They are not captures from a device. They match the app's layout, fonts, colours and text, with one deliberate choice: the Company Setup screen is shown in dark mode, because its button label is hard to read in light mode today (see `NEXT-STEPS.md` §3).

Both stores require screenshots to show the real app experience. Once the demo tenant is running, the safest set is real captures.

## Using real captures

1. On a phone or simulator signed in to the demo tenant, take a screenshot of each screen.
2. Save them in `captures/` with these names (PNG or JPG): `hero` (dashboard), `versions` (Company Setup), `apps` (New Request), `request` (New Time Off, filled in), `status` (Inbox).
3. Rebuild:

```bash
cd ../explainer-v3
node source/build-store.mjs
```

Any shot with a capture uses it inside the same device frame and caption; the rest stay as reconstructions. The log marks each file as `REAL CAPTURE` or `reconstruction`.

## Rebuilding or editing

Captions, the shot list and sizes are in `../explainer-v3/source/store-shots.html` and `build-store.mjs`. `node source/build-store.mjs --only android` (or `ios-6.9`, `ios-6.3`, `feature`, `icons`) rebuilds one set.

## Open items

- **Odoo 19.** The captions say "Odoo 15 to 19". The test suite covers 15, 17, 18 and 19 and the docs name 15–17; confirm the top of the range you want to state publicly.
- **"by Octagon9" lockup.** No Octagon9 logo file exists in the repo, so the byline is typeset in DM Sans. Swap in the official mark when there is one.
- **"Odoo" in store images.** It is used only to describe compatibility. The description carries the trademark notice.
