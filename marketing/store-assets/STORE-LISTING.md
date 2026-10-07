# Shadow — store listing copy (draft for both stores)

Paste-ready text, written to the stores' character limits. Every product claim below was checked against the repo on 6 Oct 2026 (version handling in `backend/src`, the six request types in `new-request.tsx`, the product docs' "no modules to install"). Change a claim here only if the product changes.

## Name

The client wants **Shadow (by Octagon9)**. Two things decide what the store can show:

- **The store adds the "by" line itself.** Both stores print the developer name under the app name. On Google Play that is the developer name you choose (can be "Octagon9"). On the App Store it is the **legal entity name** from the D-U-N-S record.
- **App Store names must be unique** (30 characters max). "Shadow" alone is very likely taken. Have these ready, in order:

| Order | App name | Length |
|---|---|---|
| 1 | `Shadow` | 6 |
| 2 | `Shadow by Octagon9` | 18 |
| 3 | `Shadow: Employee App` | 20 |

Don't put "Odoo" in the app name or icon. It is Odoo S.A.'s trademark; use it only to describe compatibility, as below.

## Apple App Store

| Field | Limit | Text |
|---|---|---|
| Subtitle | 30 | `Employee self-service for Odoo` |
| Promotional text | 170 | `Time off, expenses, attendance, timesheets, helpdesk and maintenance requests, sent straight to your company's Odoo, with the answer back on your phone.` |
| Keywords | 100 | `odoo,hr,employee,leave,time off,expense,attendance,timesheet,helpdesk,maintenance,erp,portal,staff` |
| Primary category | — | Business |
| Secondary category | — | Productivity |

## Google Play

| Field | Limit | Text |
|---|---|---|
| Short description | 80 | `Employee self-service for Odoo: time off, expenses, timesheets and more.` |
| App category | — | Business |
| Tags | — | Business, Productivity |

## Description (both stores, 4,000 characters max)

```
Shadow puts your company's Odoo in every employee's pocket.

Employees send their everyday requests from their phone. Each request lands in your Odoo as a normal record, your managers approve it there as they always have, and the employee sees the answer in the app.

WORKS WITH THE ODOO YOU ALREADY RUN
• Odoo 15, 16, 17, 18 and 19
• No module to install on your Odoo: Shadow uses Odoo's standard API
• Multi-company ready: each employee sees their own company's data

SIX EVERYDAY APPS IN ONE PLACE
• Time Off: pick a leave type, see your balance, choose your dates, add a document
• Expenses: file a claim with the amount, category and a photo of the receipt
• Attendance: fix a missed check-in or check-out
• Timesheets: log hours against your projects and tasks
• Helpdesk: report an issue to the right team
• Maintenance: report equipment and facility problems

CLEAR STATUS, LESS CHASING
• A notification when a request is approved or refused
• An inbox with the history of your notifications
• Light and dark mode, English and Arabic

FOR COMPANIES
Shadow is for organisations that run Odoo. Your company receives a company code; employees enter it once, then sign in with their employee ID and a PIN, a work-email code, or an invite. Approvals and records stay in Odoo. Shadow does not replace it.

Helpdesk requires Odoo's Helpdesk app, and each request type needs the matching Odoo app to be installed.

Odoo is a registered trademark of Odoo S.A. Shadow is an independent product by Octagon9 and is not affiliated with or endorsed by Odoo S.A.
```

## URLs to fill in (all three should be on Octagon9's own domain)

| Field | Value |
|---|---|
| Privacy policy | `https://<company-domain>/legal/privacy` (currently `https://erp-external-app.vercel.app/legal/privacy`) |
| Support URL | `https://<company-domain>/support` |
| Marketing URL (optional) | `https://<company-domain>/shadow` |
| Account deletion (Play) | `https://<company-domain>/legal/delete-account` |

## App Review notes (Apple) and App access (Google)

Use the text in the root `STORE_SUBMISSION.md` §4.4, with the new name:

```
Shadow is a multi-tenant B2B employee self-service app, comparable to the Odoo, Workday or BambooHR mobile apps. It is not an internal app for one company: any company running Odoo can subscribe, receive a company code, and onboard its employees through the Company Setup screen.

Demo access for review:
Company code: [from the demo tenant]   Employee ID: [...]   PIN: [...]
Steps: open the app → enter the company code → enter the employee ID and PIN.
Accounts are created by each subscribing company's HR (invite or work-email code), which is why there is no public sign-up.
```

## Screenshot captions (already in the images)

1. Your Odoo. In every pocket. — *The employee app for Odoo.*
2. Works with Odoo 15 to 19. — *No module to install. Just your company code.*
3. Six everyday apps. One place. — *Time off · Expenses · Attendance · Timesheets · Helpdesk · Maintenance*
4. Request time off in a few taps. — *With your live leave balance from Odoo.*
5. Approved in Odoo. Answered in the app. — *A notification when your request is approved or refused.*
