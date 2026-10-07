# Checkpoint 1 — source-of-truth check and assumptions

28 September 2026. Paths are relative to the repository root.

## Demo record (synthetic, used consistently)

| Item | Value | Why |
|---|---|---|
| Employee | Yasmine Alaoui, Sales | Fictional; no real employee data |
| Leave type | **Paid Time Off** | Odoo's default type name, seen in the Odoo 17 docs screenshot |
| Dates | 2026-10-12 → 2026-10-16 (Mon–Fri) | `countWeekdays` gives "≈ 5 days" |
| Balance | 18 days / 24 | Synthetic allocation, shown in the app's Balance row |
| Reason / Odoo Description | Family trip | Written by the backend as `name`, the Description field in Odoo |
| Company CTA | **Meet Shadow Portal.** | No demo-booking destination was supplied |

## Verified product behaviour, and where it shows in the film

- **Submit** (`production-version/app/(app)/new-request.tsx`): "Submit Request" calls `POST /time-off`.
  On success the app shows the toast "Time off request submitted!" and returns to the New Request hub.
  → Shot 03 result.
- **Backend** (`backend/src/routes/time_off.ts`): creates an `hr.leave` record with `employee_id`, the
  leave type, `date_from`/`date_to`, `name` and `request_date_from`/`request_date_to`, and attaches
  files to it. → Shot 04 shows that record.
- **Odoo 17 record**, checked against Odoo's own source (`addons/hr_holidays/views/hr_leave_views.xml`
  and `models/hr_leave.py`, branch 17.0):
  - The header has "Approve" (`action_approve`, primary, visible in state `confirm`) and "Refuse".
  - The status bar shows `confirm` → `validate`, labelled "To Approve" → "Approved".
  - The fields are Time Off Type, dates, Duration, Description and Supporting Document.
  - The record title follows "%(person)s on %(leave_type)s: %(duration).2f days (%(start)s)".
- **Approval is a manager action in Odoo.** Submitting never approves anything. Shot 04 shows a pointer
  pressing Approve before the state changes.
- **After approval Odoo re-renders the header** (re-checked in `hr_leave_views.xml`, branch 17.0, on 28 Sep 2026):
  Approve is `invisible="… or state != 'confirm'"`, Refuse stays visible for `confirm`, `validate1` and `validate`,
  and the status bar is `statusbar_visible="confirm,validate"`. The film therefore goes from [Approve][Refuse] to
  [Refuse] with "Approved" current, about 150 ms after the click is released (a plausible round trip, not a measured one).
- **Submit press** (`production-version/components/ui/button.tsx`): pressIn springs the button to scale 1.05
  (damping 15, stiffness 400, mass 0.5), pressOut springs back (damping 20, stiffness 400, mass 0.8), and
  `disabled={loading}` renders it at 50 % opacity with an `ActivityIndicator`. The film integrates those exact springs.
- **Toast** (`production-version/providers/toast-context.tsx`): no entry animation; auto-dismiss after 3 s. The film shows
  it from the cut and holds 2 s, inside its real lifetime.
- **Inbox strings** (`production-version/locales/en.json`): "{{count}} unread message(s)"; groups appear only when they have
  items. Shot 05 opens on "0 unread messages" with yesterday's item, then inserts the Today group ("1 unread message").
- **Employee status** (`backend/src/lib/requestMonitor.ts`): a monitor compares states and, on
  approval, stores an in-app notification titled "Request Approved ✅" with the message `Your time off
  request "<name>" has been approved.`, and sends a push. It works by polling, so there is **no
  delivery-time guarantee**. The film says "Clear status", never "instant".
- **Notifications screen** (`production-version/app/(app)/notifications.tsx`):
  - Title "Inbox", subtitle "1 unread message", group label "TODAY".
  - An approved item shows a green check in a 48 px circle, the title in Outfit 700 17 px, and the time.
  - The body is DM Sans 500 15 px.
  - Unread items have a blue tint.
  
  → Shot 05.
- **Raw state labels:** the list and detail screens show Odoo's raw state (`confirm`, `validate`).
  Shot 05 therefore uses the Inbox notification, which states the approval in words, rather than
  enlarging a raw `validate` badge.

## Reconstruction, not capture

Every app screen in the film is reconstructed in HTML/CSS from the component source, in the app's
light theme (`production-version/theme/colors.ts`). A clean deterministic capture was not available,
for three reasons:
- There is no demo tenant or credentials.
- The date picker (`@react-native-community/datetimepicker`) has no web implementation, so a web build
  can't show selected dates.
- Changing app code to enable a capture is out of scope.

The Odoo record is an **isolated reconstruction of the relevant fields**, styled after the official
Odoo 17 documentation screenshot. It is not a capture of a live instance. `assets-manifest.csv`
records this. It is set in the system UI font (Segoe UI on the render machine), as Odoo's web client uses the
system font stack. The portrait cut shows the same fields in a narrow, stacked arrangement.

Fidelity details taken from source:
- The date field shows `toISOString().split('T')[0]`, i.e. **2026-10-12**. v1 wrongly showed
  "Mon, Oct 12, 2026".
- The date text inherits DM Sans from the app's `Text` component.
- The toast is a white card with a 4 px left border in success green, a 36 px mint icon circle,
  15 px text and 16 px radius. The text is set at DM Sans weight 500, because the source asks for
  weight 600 of a family registered as Regular only.
- The app loads only Outfit 400/500/700 and DM Sans 400/500/700.

## Measurements of the existing cut (the baseline)

- `marketing/intro-video/out/shadow-portal-intro.mp4`: 1920×1080, 60 fps, 1,140 decoded frames,
  19.000 s, −12.4 LUFS, −1.5 dBTP. Drop and logo hits aligned within ±2 frames.
- `shadow-portal-intro-vertical.mp4`: 1080×1920, 60 fps, 1,140 decoded frames. Same audio measurements.

## Environment limits

- **Blender is not installed.** Per the brief, no global software was installed. The device is an
  original procedural model rendered with three.js r180, a local dependency of this folder, in
  headless Chrome on the discrete GPU.
- **No purchases were made.** The route needs none. Optional upgrades are listed in `README.md`.
- **I can't hear audio.** Audio is checked by measurement only, and human listening remains pending.
