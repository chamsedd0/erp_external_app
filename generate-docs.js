const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageNumber, PageBreak, ExternalHyperlink,
    LevelFormat, TableOfContents, UnderlineType,
} = require('docx');
const fs = require('fs');

// ── Colours ──────────────────────────────────────────────────────────────────
const BRAND       = '1A1A2E';   // deep navy (brand primary)
const ACCENT      = '4F8EF7';   // blue accent
const LIGHT_BG    = 'EEF3FB';   // pale blue tint for table headers
const MID_BG      = 'F7F9FD';   // very pale for alternating rows
const RULE_COLOR  = 'D0D9EC';   // horizontal rule / table border colour
const WHITE       = 'FFFFFF';
const BODY_GREY   = '3A3A4A';   // body text
const MUTED       = '6B7080';   // secondary / caption text

// ── Helpers ───────────────────────────────────────────────────────────────────
const pt   = n => n * 2;          // half-points (docx size unit)
const dxa  = n => n * 1440;       // DXA from inches

const border = (color = RULE_COLOR) => ({ style: BorderStyle.SINGLE, size: 1, color });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });

function rule(color = RULE_COLOR, spaceAfter = 120) {
    return new Paragraph({
        spacing: { after: spaceAfter, before: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color } },
        children: [],
    });
}

function spacer(after = 120) {
    return new Paragraph({ spacing: { after }, children: [] });
}

function h1(text, opts = {}) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 160 },
        ...opts,
        children: [new TextRun({ text, font: 'Arial', size: pt(18), bold: true, color: BRAND })],
    });
}

function h2(text, opts = {}) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        ...opts,
        children: [new TextRun({ text, font: 'Arial', size: pt(13), bold: true, color: BRAND })],
    });
}

function h3(text) {
    return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 80 },
        children: [new TextRun({ text, font: 'Arial', size: pt(11), bold: true, color: ACCENT })],
    });
}

function body(text, opts = {}) {
    return new Paragraph({
        spacing: { after: 140 },
        ...opts,
        children: [new TextRun({ text, font: 'Arial', size: pt(11), color: BODY_GREY })],
    });
}

function caption(text) {
    return new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text, font: 'Arial', size: pt(9), color: MUTED, italics: true })],
    });
}

function bullet(text, bold_lead = '') {
    const runs = [];
    if (bold_lead) {
        runs.push(new TextRun({ text: bold_lead + ' ', font: 'Arial', size: pt(11), bold: true, color: BODY_GREY }));
    }
    runs.push(new TextRun({ text, font: 'Arial', size: pt(11), color: BODY_GREY }));
    return new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 80 },
        children: runs,
    });
}

function numberItem(text, bold_lead = '') {
    const runs = [];
    if (bold_lead) {
        runs.push(new TextRun({ text: bold_lead + ' ', font: 'Arial', size: pt(11), bold: true, color: BODY_GREY }));
    }
    runs.push(new TextRun({ text, font: 'Arial', size: pt(11), color: BODY_GREY }));
    return new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        spacing: { after: 80 },
        children: runs,
    });
}

// ── Feature table helper ──────────────────────────────────────────────────────
function featureTable(rows) {
    const cellBorders = {
        top: border(), bottom: border(), left: noBorder(), right: noBorder(),
    };
    const makeRow = (icon, title, desc, isHeader = false) => new TableRow({
        children: [
            new TableCell({
                width: { size: 800, type: WidthType.DXA },
                borders: cellBorders,
                shading: { fill: isHeader ? LIGHT_BG : MID_BG, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 140, right: 60 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: icon, font: 'Arial', size: pt(18) })],
                })],
            }),
            new TableCell({
                width: { size: 2600, type: WidthType.DXA },
                borders: cellBorders,
                shading: { fill: isHeader ? LIGHT_BG : WHITE, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 140, right: 100 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: title, font: 'Arial', size: pt(11), bold: true, color: isHeader ? BRAND : BODY_GREY })],
                })],
            }),
            new TableCell({
                width: { size: 5960, type: WidthType.DXA },
                borders: cellBorders,
                shading: { fill: isHeader ? LIGHT_BG : WHITE, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 100, right: 140 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: desc, font: 'Arial', size: pt(11), color: isHeader ? BRAND : MUTED })],
                })],
            }),
        ],
    });

    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [800, 2600, 5960],
        rows: [
            makeRow('', 'Feature', 'Description', true),
            ...rows.map(r => makeRow(r[0], r[1], r[2])),
        ],
    });
}

// ── Two-column info box ───────────────────────────────────────────────────────
function infoBox(leftItems, rightItems, title) {
    const halfW = 4680;
    const makeCell = (items) => new TableCell({
        width: { size: halfW, type: WidthType.DXA },
        borders: { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() },
        shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        children: items.map(i => new Paragraph({
            numbering: { reference: 'check', level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: i, font: 'Arial', size: pt(10), color: BODY_GREY })],
        })),
    });

    const rows = [];
    if (title) {
        rows.push(new TableRow({
            children: [new TableCell({
                columnSpan: 2,
                width: { size: 9360, type: WidthType.DXA },
                borders: { top: noBorder(), bottom: border(ACCENT), left: noBorder(), right: noBorder() },
                shading: { fill: ACCENT, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 180, right: 180 },
                children: [new Paragraph({
                    children: [new TextRun({ text: title, font: 'Arial', size: pt(12), bold: true, color: WHITE })],
                })],
            })],
        }));
    }
    rows.push(new TableRow({ children: [makeCell(leftItems), makeCell(rightItems)] }));

    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [halfW, halfW],
        rows,
    });
}

// ── Step box for "How it works" ───────────────────────────────────────────────
function stepRow(num, label, desc) {
    const nb = { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() };
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 600, type: WidthType.DXA },
                borders: nb,
                shading: { fill: ACCENT, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: num, font: 'Arial', size: pt(14), bold: true, color: WHITE })],
                })],
            }),
            new TableCell({
                width: { size: 2400, type: WidthType.DXA },
                borders: nb,
                shading: { fill: MID_BG, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 160, right: 120 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: label, font: 'Arial', size: pt(11), bold: true, color: BRAND })],
                })],
            }),
            new TableCell({
                width: { size: 6360, type: WidthType.DXA },
                borders: nb,
                shading: { fill: WHITE, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 160, right: 160 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: desc, font: 'Arial', size: pt(11), color: MUTED })],
                })],
            }),
        ],
    });
}

function stepsTable(steps) {
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [600, 2400, 6360],
        rows: steps.map((s, i) => stepRow(String(i + 1), s[0], s[1])),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
    numbering: {
        config: [
            {
                reference: 'bullets',
                levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
            },
            {
                reference: 'numbers',
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
            },
            {
                reference: 'check',
                levels: [{ level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 480, hanging: 240 } } } }],
            },
        ],
    },
    styles: {
        default: { document: { run: { font: 'Arial', size: pt(11), color: BODY_GREY } } },
        paragraphStyles: [
            {
                id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: pt(18), bold: true, font: 'Arial', color: BRAND },
                paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
            },
            {
                id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: pt(13), bold: true, font: 'Arial', color: BRAND },
                paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 },
            },
            {
                id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: pt(11), bold: true, font: 'Arial', color: ACCENT },
                paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 },
            },
        ],
    },
    sections: [
        // ═══════════════════════════════════════════════════════════════
        // SECTION 1 — COVER PAGE
        // ═══════════════════════════════════════════════════════════════
        {
            properties: {
                page: {
                    size: { width: 12240, height: 15840 },
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
            },
            children: [
                spacer(2880),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 80 },
                    children: [new TextRun({ text: 'SHADOW PORTAL', font: 'Arial', size: pt(38), bold: true, color: BRAND })],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 320 },
                    children: [new TextRun({ text: 'Employee Self-Service Mobile App', font: 'Arial', size: pt(16), color: ACCENT })],
                }),
                rule(ACCENT, 240),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 240, after: 80 },
                    children: [new TextRun({
                        text: 'Product Overview & Feature Guide',
                        font: 'Arial', size: pt(13), italics: true, color: MUTED,
                    })],
                }),
                spacer(2400),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [new TextRun({ text: 'Version 1.0', font: 'Arial', size: pt(10), color: MUTED })],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '2025', font: 'Arial', size: pt(10), color: MUTED })],
                }),
            ],
        },

        // ═══════════════════════════════════════════════════════════════
        // SECTION 2 — TABLE OF CONTENTS + BODY
        // ═══════════════════════════════════════════════════════════════
        {
            properties: {
                page: {
                    size: { width: 12240, height: 15840 },
                    margin: { top: 1080, right: 1260, bottom: 1080, left: 1260 },
                },
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_COLOR } },
                            spacing: { after: 80 },
                            children: [
                                new TextRun({ text: 'Shadow Portal', font: 'Arial', size: pt(9), color: ACCENT, bold: true }),
                                new TextRun({ text: '   |   Product Overview', font: 'Arial', size: pt(9), color: MUTED }),
                            ],
                        }),
                    ],
                }),
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_COLOR } },
                            spacing: { before: 80 },
                            children: [
                                new TextRun({ text: 'Page ', font: 'Arial', size: pt(9), color: MUTED }),
                                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: pt(9), color: MUTED }),
                                new TextRun({ text: ' of ', font: 'Arial', size: pt(9), color: MUTED }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: pt(9), color: MUTED }),
                                new TextRun({ text: '   \u00B7   Confidential', font: 'Arial', size: pt(9), color: MUTED }),
                            ],
                        }),
                    ],
                }),
            },
            children: [

                // ── TABLE OF CONTENTS ──────────────────────────────────
                h1('Table of Contents'),
                rule(ACCENT),
                spacer(160),
                new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
                new Paragraph({ children: [new PageBreak()] }),

                // ── 1. OVERVIEW ────────────────────────────────────────
                h1('1.  What is Shadow Portal?'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal is a branded mobile application that gives your employees instant, on-the-go access to the everyday HR and operational tasks they normally have to log into a desktop system to complete. Built for companies that run Odoo as their core business system, Shadow Portal acts as a clean, modern front door to your Odoo data — without requiring employees to ever open Odoo themselves.'
                ),
                body(
                    'Employees can submit time-off requests, file expense claims, raise IT support tickets, log maintenance issues, record their working hours, and receive real-time updates on anything that concerns them — all from their phone, in seconds.'
                ),
                body(
                    'For HR teams and managers, this means fewer emails, fewer interruptions, and a single organised place where every employee request flows through for review and approval.'
                ),
                spacer(80),

                // ── 2. THE PROBLEM ─────────────────────────────────────
                h1('2.  The Problem We Solve'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Most businesses rely on Odoo (or similar ERP systems) to manage their workforce, but the experience for everyday employees is often painful:'
                ),
                bullet('Employees log in to a complex desktop interface just to submit a holiday request.'),
                bullet('Expense receipts are emailed or handed in as paper copies, then manually entered.'),
                bullet('IT faults are reported by WhatsApp or word-of-mouth, with no tracking.'),
                bullet('Timesheets are forgotten because filling them in requires a computer.'),
                bullet('Nobody knows the status of their request without asking HR directly.'),
                spacer(120),
                body(
                    'Shadow Portal solves all of this with a simple, beautifully designed mobile app that anyone can use in under a minute.'
                ),
                spacer(80),

                // ── 3. FEATURES ────────────────────────────────────────
                h1('3.  Core Features'),
                rule(ACCENT),
                spacer(80),
                body('Every feature listed below is included in the standard Shadow Portal package.'),
                spacer(120),

                featureTable([
                    ['[1]', 'Time Off Requests',   'Employees can browse their leave balance, pick dates, choose the leave type, and submit a request — all without touching Odoo. Managers receive the request and approve or reject it from within Odoo as usual.'],
                    ['[2]', 'Expense Claims',        'Submit an expense in seconds: choose a category, enter the amount, add a description and date, and attach a photo of your receipt. No paper forms, no email chains.'],
                    ['[3]', 'IT & Helpdesk Support', 'Raise a support ticket instantly. Employees describe the issue, choose a priority, and the ticket lands directly in the helpdesk queue for your IT team to action.'],
                    ['[4]', 'Maintenance Requests',  'Log a fault or maintenance need against any piece of equipment or location. Great for facilities, manufacturing, or any business with physical assets.'],
                    ['[5]', 'Timesheet Submission',  'Log hours against projects or tasks right from the phone. Ideal for field teams, consultants, or anyone who tracks billable or project time.'],
                    ['[6]', 'Push Notifications',    'Employees are instantly notified when their request is approved, rejected, or updated — no need to check back manually. Notifications work even when the app is closed.'],
                ]),
                spacer(200),

                // ── 4. HOW IT WORKS ────────────────────────────────────
                h1('4.  How It Works'),
                rule(ACCENT),
                spacer(80),
                body('Getting started is straightforward. Once Shadow Portal is connected to your Odoo system, the employee experience is entirely self-contained within the app.'),
                spacer(120),

                h2('4.1  Employee Journey'),
                spacer(80),
                stepsTable([
                    ['Download the App',    'The employee installs Shadow Portal on their iPhone or Android device from the app store.'],
                    ['Enter Company Code',  'On first launch, the employee types in a short company code provided by your IT or HR team (e.g. "acmecorp"). This takes less than ten seconds and only ever needs to be done once.'],
                    ['Log In',              'The employee signs in with their Employee ID and a 4-digit PIN, both set by HR. No passwords to remember, no reset emails.'],
                    ['Submit Requests',     'From the home screen the employee can submit any type of request with just a few taps.'],
                    ['Get Notified',        'As soon as a manager acts on the request, the employee receives a push notification with the outcome.'],
                ]),
                spacer(200),

                h2('4.2  Manager / HR Experience'),
                spacer(80),
                body(
                    'Shadow Portal does not require managers or HR staff to change how they work. All approvals, rejections, and record-keeping continue to happen inside Odoo exactly as before. Shadow Portal is purely a submission layer for employees — the data flows directly into Odoo, where your existing approval workflows take over.'
                ),
                spacer(80),
                body('Key points for HR teams:'),
                bullet('No new system to learn — approvals stay in Odoo.'),
                bullet('Employee data (names, IDs, leave balances, expense categories) is read directly from Odoo, so there is no duplicate data entry.'),
                bullet('PINs are managed in Odoo\'s employee record and can be reset by HR at any time.'),
                bullet('The app always reflects the live state of Odoo — balances, statuses, and history are always up to date.'),
                spacer(80),

                // ── 5. NOTIFICATIONS ───────────────────────────────────
                new Paragraph({ children: [new PageBreak()] }),
                h1('5.  Real-Time Notifications'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal continuously monitors each employee\'s pending requests and sends a push notification the moment anything changes. This works in the background, even when the phone is locked or the app is closed.'
                ),
                spacer(80),
                body('Employees are notified when:'),
                bullet('A time-off request is approved or refused.'),
                bullet('An expense claim is validated or rejected.'),
                bullet('A helpdesk or maintenance ticket is updated.'),
                bullet('Any other HR action is taken on their record.'),
                spacer(120),
                body(
                    'All notifications are stored in the app\'s Notifications tab with timestamps and details, so employees can review them at any point even if they missed the alert.'
                ),
                spacer(80),

                // ── 6. MULTI-COMPANY ──────────────────────────────────
                h1('6.  Multi-Company Support'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal is built from the ground up as a multi-company platform. A single deployment of the app and backend can serve multiple separate companies simultaneously, each with their own completely independent Odoo instance, employee data, and notification stream.'
                ),
                spacer(80),
                body('This makes Shadow Portal ideal for:'),
                bullet('HR software resellers who want to offer it to multiple client organisations.'),
                bullet('Holding companies with several subsidiaries, each running their own Odoo.'),
                bullet('Any business that operates multiple legal entities or brands.'),
                spacer(120),
                body('Each company receives:'),
                bullet('A unique company code used at first launch.'),
                bullet('Fully isolated employee data — no cross-company visibility.'),
                bullet('Its own HR contact email shown to employees within the app.'),
                bullet('Its own Odoo connection with separate credentials.'),
                spacer(80),
                body(
                    'New companies are registered by the platform administrator in seconds via a simple API call. There is no limit to the number of companies the system can support.'
                ),
                spacer(80),

                // ── 7. SECURITY ────────────────────────────────────────
                h1('7.  Security & Privacy'),
                rule(ACCENT),
                spacer(80),
                body('Shadow Portal is designed with security as a first-class concern throughout.'),
                spacer(80),
                infoBox(
                    [
                        'JWT-based authentication — every session is authenticated with a signed token',
                        'Tokens expire and must be renewed on next login',
                        'Employee PIN is verified directly against Odoo — never stored on the phone',
                        'All API communication is encrypted over HTTPS',
                    ],
                    [
                        'Admin functions (registering companies) require a separate secret key',
                        'Each company\'s data is fully isolated — employees only see their own company\'s data',
                        'Push tokens are stored per-company and per-employee, with no cross-tenant access',
                        'No employee passwords are ever stored or transmitted by the app',
                    ],
                    'Security at a glance'
                ),
                spacer(200),

                // ── 8. WHAT YOU NEED ──────────────────────────────────
                h1('8.  What Your Business Needs to Get Started'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal requires minimal setup on your side. The technical onboarding is handled by our team — you simply provide the connection details for your Odoo instance.'
                ),
                spacer(80),

                h2('8.1  Prerequisites'),
                spacer(80),
                body('To connect Shadow Portal to your business, you need:'),
                numberItem('An active Odoo instance', '(cloud-hosted or on-premise, version 16 or later recommended).'),
                numberItem('An Odoo service account', '(an admin-level user dedicated to the app — your IT team can create this in under five minutes).'),
                numberItem('Employees configured in Odoo', 'with an Employee ID (badge number) and a 4-digit PIN set in their HR record.'),
                numberItem('A mobile device per employee', 'running iOS 14+ or Android 10+.'),
                spacer(120),

                h2('8.2  What We Handle'),
                spacer(80),
                body('Once you provide the above, our team takes care of:'),
                bullet('Registering your company on the Shadow Portal platform.'),
                bullet('Connecting to your Odoo instance and verifying the integration.'),
                bullet('Providing your IT or HR team with the company code and onboarding guide.'),
                bullet('Advising on distributing the app to your employees (direct download or app store).'),
                spacer(80),

                // ── 9. SETTINGS & CUSTOMISATION ───────────────────────
                h1('9.  Employee-Facing Settings'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal includes a settings area where employees can manage their own experience. All settings are accessible from the app\'s profile / menu screen.'
                ),
                spacer(80),

                featureTable([
                    ['[A]', 'Dark Mode',           'Employees can switch between light and dark themes, or let the app follow their phone\'s system setting automatically.'],
                    ['[B]', 'Notification Control','Each employee can choose which types of push notifications they receive and when.'],
                    ['[C]', 'Change Company',      'If an employee moves to a different company on the platform, they can switch their company link directly from settings without reinstalling the app.'],
                    ['[D]', 'Clear Cache',         'Employees can clear locally cached data if needed, for example when troubleshooting or switching devices.'],
                ]),
                spacer(200),

                // ── 10. HELP & SUPPORT ─────────────────────────────────
                h1('10.  Help & Support Within the App'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal includes a built-in Help & Support screen accessible from the main menu. This provides employees with:'
                ),
                bullet('A curated FAQ covering the most common questions about time off, expenses, PIN resets, and more.'),
                bullet('A one-tap "Email HR" button that pre-populates an email to your company\'s HR contact.'),
                bullet('A one-tap "Reset PIN" button that opens a pre-filled email to HR requesting a PIN reset.'),
                spacer(120),
                body(
                    'The HR email address shown is specific to each company and is configured by the platform administrator — employees always reach the right person.'
                ),
                spacer(80),

                // ── 11. SUMMARY ────────────────────────────────────────
                new Paragraph({ children: [new PageBreak()] }),
                h1('11.  Summary'),
                rule(ACCENT),
                spacer(80),
                body(
                    'Shadow Portal bridges the gap between your Odoo ERP system and your employees\' everyday experience. It removes friction, reduces administrative overhead, and gives employees the self-service tools they expect from a modern workplace — all without changing how your managers and HR team operate.'
                ),
                spacer(120),
                infoBox(
                    [
                        'Time off requests — submitted in seconds',
                        'Expense claims with receipt attachments',
                        'IT helpdesk and maintenance request logging',
                        'Timesheet submission from anywhere',
                        'Real-time push notifications on request status',
                    ],
                    [
                        'Works with any Odoo version 16+',
                        'Supports iOS and Android',
                        'Multi-company ready out of the box',
                        'No new system for managers to learn',
                        'Minimal setup — live within days',
                    ],
                    'Shadow Portal at a Glance'
                ),
                spacer(240),
                rule(ACCENT, 200),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [new TextRun({ text: 'Ready to get started?', font: 'Arial', size: pt(14), bold: true, color: BRAND })],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({
                        text: 'Contact us to arrange a demo or begin onboarding your company.',
                        font: 'Arial', size: pt(11), color: MUTED,
                    })],
                }),
            ],
        },
    ],
});

Packer.toBuffer(doc).then(buf => {
    const out = 'Shadow-Portal-Product-Overview.docx';
    fs.writeFileSync(out, buf);
    console.log('Written:', out, `(${(buf.length / 1024).toFixed(1)} KB)`);
});
