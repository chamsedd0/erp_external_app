const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
    UnderlineType
} = require('docx');
const fs = require('fs');

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
    navy:    '1B2A4A',
    blue:    '2563EB',
    blue2:   '3B82F6',
    steel:   'EFF6FF',
    steelDk: 'DBEAFE',
    slate:   '475569',
    muted:   '94A3B8',
    white:   'FFFFFF',
    black:   '0F172A',
    border:  'CBD5E1',
    hdr:     'D1FAE5',   // light green for section headers
    hdrDk:   '059669',
    warn:    'FEF3C7',
    warnDk:  'D97706',
    code:    'F1F5F9',
};

// ── Reusable border set ───────────────────────────────────────────────────────
const tblBorder = (color = C.border) => ({
    style: BorderStyle.SINGLE, size: 4, color
});
const borders = (color = C.border) => ({
    top: tblBorder(color), bottom: tblBorder(color),
    left: tblBorder(color), right: tblBorder(color),
    insideHorizontal: tblBorder(color), insideVertical: tblBorder(color),
});
const cellBorders = (color = C.border) => ({
    top: tblBorder(color), bottom: tblBorder(color),
    left: tblBorder(color), right: tblBorder(color),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const spacer = (pts = 6) => new Paragraph({
    children: [new TextRun('')],
    spacing: { before: 0, after: pts * 20 },
});

const hr = () => new Paragraph({
    children: [new TextRun('')],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blue, space: 2 } },
    spacing: { before: 80, after: 200 },
});

const txt = (text, opts = {}) => new TextRun({ text, font: 'Arial', size: 22, color: C.black, ...opts });
const bold = (text, opts = {}) => txt(text, { bold: true, ...opts });
const muted = (text) => txt(text, { color: C.slate, size: 20 });
const code = (text) => txt(text, { font: 'Courier New', size: 18, color: '7C3AED', shading: { type: ShadingType.CLEAR, fill: C.code } });

const para = (children, opts = {}) => new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { before: 40, after: 120 },
    ...opts,
});

const heading1 = (text, color = C.navy) => new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Arial', bold: true, color, size: 36 })],
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue, space: 4 } },
});

const heading2 = (text) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: 'Arial', bold: true, color: C.navy, size: 28 })],
    spacing: { before: 320, after: 160 },
});

const heading3 = (text, color = C.blue) => new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: 'Arial', bold: true, color, size: 24 })],
    spacing: { before: 240, after: 120 },
});

const bullet = (text, lvl = 0, bold_ = false) => new Paragraph({
    numbering: { reference: 'bullets', level: lvl },
    children: [txt(text, { bold: bold_, size: 21 })],
    spacing: { before: 40, after: 60 },
});

const numbered = (text) => new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: [txt(text, { size: 21 })],
    spacing: { before: 60, after: 60 },
});

const checkbox = (text) => new Paragraph({
    numbering: { reference: 'checkboxes', level: 0 },
    children: [txt(text, { size: 21 })],
    spacing: { before: 40, after: 40 },
});

const codeBlock = (lines) => lines.map(line => new Paragraph({
    children: [new TextRun({ text: line, font: 'Courier New', size: 18, color: '1E293B' })],
    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
    spacing: { before: 0, after: 0 },
    indent: { left: 360 },
    border: line === lines[0]
        ? { top: tblBorder('CBD5E1'), left: { style: BorderStyle.SINGLE, size: 16, color: C.blue }, bottom: line === lines[lines.length-1] ? tblBorder('CBD5E1') : { style: BorderStyle.NONE } }
        : line === lines[lines.length-1]
            ? { bottom: tblBorder('CBD5E1'), left: { style: BorderStyle.SINGLE, size: 16, color: C.blue } }
            : { left: { style: BorderStyle.SINGLE, size: 16, color: C.blue } },
})).concat([spacer(4)]);

// ── Table helpers ─────────────────────────────────────────────────────────────
const CONTENT_W = 9360; // US Letter 1" margins

const headerCell = (text, w, color = C.navy, textColor = C.white) =>
    new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: cellBorders(C.navy),
        shading: { type: ShadingType.CLEAR, fill: color },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({
            children: [new TextRun({ text, font: 'Arial', bold: true, size: 20, color: textColor })],
        })],
    });

const dataCell = (text, w, fill = C.white, textColor = C.black, bold_ = false) =>
    new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: cellBorders(C.border),
        shading: { type: ShadingType.CLEAR, fill },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({
            children: [new TextRun({ text, font: 'Arial', size: 19, color: textColor, bold: bold_ })],
            spacing: { before: 0, after: 0 },
        })],
    });

const dataRow = (cells, fills) =>
    new TableRow({
        children: cells.map(([text, w, fill, color, bold_]) =>
            dataCell(text, w, fill || C.white, color || C.black, bold_ || false)
        ),
    });

// ── Callout box (single-row single-cell table) ────────────────────────────────
const callout = (title, lines, fill = C.steel, titleColor = C.blue, borderColor = C.blue) =>
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        borders: { ...borders(borderColor), insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [new TableRow({
            children: [new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                borders: cellBorders(borderColor),
                shading: { type: ShadingType.CLEAR, fill },
                margins: { top: 140, bottom: 140, left: 200, right: 200 },
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, font: 'Arial', bold: true, size: 22, color: titleColor })], spacing: { before: 0, after: 80 } }),
                    ...lines.map(l => new Paragraph({ children: [txt(l, { size: 20 })], spacing: { before: 0, after: 60 } })),
                ],
            })],
        })],
    });

// ─────────────────────────────────────────────────────────────────────────────
// COVER PAGE
// ─────────────────────────────────────────────────────────────────────────────
const cover = [
    spacer(120),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({
            children: [new TableCell({
                width: { size: CONTENT_W, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: C.navy },
                borders: cellBorders(C.navy),
                margins: { top: 600, bottom: 600, left: 500, right: 500 },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 160 },
                        children: [new TextRun({ text: 'SHADOW', font: 'Arial', bold: true, size: 96, color: C.white })],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 200 },
                        children: [new TextRun({ text: 'Mobile ERP Companion for Odoo', font: 'Arial', size: 32, color: 'BAE6FD' })],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '3B82F6', space: 6 } },
                        spacing: { before: 160, after: 0 },
                        children: [new TextRun({ text: 'Complete Documentation  |  Technical & Non-Technical Reference  |  Version 1.0', font: 'Arial', size: 22, color: '93C5FD' })],
                    }),
                ],
            })],
        })],
    }),
    spacer(40),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4],
        rows: [new TableRow({
            children: [
                ['Android App', 'React Native'], ['Node.js Backend', 'Vercel'], ['Odoo v15-17', 'XML-RPC'], ['242 Tests', 'Passing'],
            ].map(([top, bot]) => new TableCell({
                width: { size: CONTENT_W / 4, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: C.steelDk },
                borders: cellBorders(C.steelDk),
                margins: { top: 160, bottom: 160, left: 120, right: 120 },
                children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: top, font: 'Arial', bold: true, size: 22, color: C.navy })], spacing: { before: 0, after: 60 } }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: bot, font: 'Arial', size: 20, color: C.slate })], spacing: { before: 0, after: 0 } }),
                ],
            })),
        })],
    }),
    spacer(40),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [txt('Shadow v1.0  |  Built with Expo SDK 54 + Node.js + Odoo XML-RPC  |  2026', { size: 18, color: C.muted })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — WHAT IS SHADOW?
// ─────────────────────────────────────────────────────────────────────────────
const sec1 = [
    heading1('Section 1 — What Is Shadow?'),
    para([txt('Shadow is a mobile application that connects employees to their company\'s Odoo ERP system directly from their smartphone. Instead of logging into a web browser and navigating complex menus, employees use Shadow to submit leave requests, file expense claims, log timesheets, open IT support tickets, and report maintenance issues — all from a clean, simple mobile interface.', { size: 22 })]),
    spacer(4),

    heading2('1.1  Who Is It For?'),
    para([txt('Shadow is designed for companies already using Odoo ERP (version 15 or later). It benefits three groups:')]),
    bullet('Employees — Submit requests and check status on the go, without needing access to Odoo.', 0, false),
    bullet('HR Departments — Reduce email volume; requests flow directly into Odoo workflows.', 0, false),
    bullet('IT Administrators — Zero Odoo customisation needed. Shadow reads your existing data via the standard API.', 0, false),
    spacer(8),

    heading2('1.2  What Can Employees Do?'),
    para([txt('The table below summarises every feature available in Shadow and where each piece of data lives in Odoo.')]),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2600, 3800, 2960],
        rows: [
            new TableRow({ children: [headerCell('Feature', 2600), headerCell('What It Does', 3800), headerCell('Where It Goes in Odoo', 2960)] }),
            ...([
                ['Time Off Requests', 'Submit annual leave, sick leave, or any custom leave type configured in Odoo', 'hr.leave model'],
                ['Expense Claims', 'File receipts with photos, amounts, and categories. Up to 3 attachments per claim.', 'hr.expense model'],
                ['Timesheet Logging', 'Log hours against active projects and tasks with a description', 'account.analytic.line'],
                ['IT Support Tickets', 'Open helpdesk tickets with subject, description, team, and attachments', 'helpdesk.ticket model'],
                ['Maintenance Requests', 'Report equipment issues — corrective or preventive, with category and photos', 'maintenance.request model'],
                ['Push Notifications', 'Real-time alerts when requests are approved or rejected by a manager', 'Expo Push + Redis store'],
                ['Notification History', 'Full timeline of all approvals, rejections, and system messages', 'Redis (tenant-scoped)'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2600, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 3800, i % 2 === 0 ? C.white : 'F8FAFC'),
                        dataCell(c, 2960, i % 2 === 0 ? C.white : 'F8FAFC', '7C3AED'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('1.3  How Does Company Isolation Work?'),
    para([txt('Shadow is a multi-tenant application. Each company gets its own completely isolated environment — one app installation serves unlimited companies and data never crosses between them. Employees identify their company by entering a short company code on first launch, then authenticate with their employee ID and PIN.')]),
    spacer(4),
    callout('Tenant Isolation Guarantee', [
        'Every Redis key is scoped to a tenant prefix: shadow:t:{tenantId}:{resource}',
        'Every JWT token carries a tenantId claim that is verified on every API call.',
        'Odoo credentials are stored per-tenant; each company connects to its own Odoo instance.',
        'A user from Company A cannot read, write, or even detect the existence of Company B data.',
    ], C.steel, C.blue, C.blue2),
    spacer(12),

    heading2('1.4  What Does Shadow NOT Do?'),
    para([txt('It is equally important to understand what Shadow is not:')]),
    bullet('It does not replace Odoo. Approvals, accounting, payroll, and HR workflows still happen inside Odoo. Shadow is a submission interface only.', 0),
    bullet('It does not store employee personal data permanently. All employee information is read live from Odoo at request time and is never cached long-term.', 0),
    bullet('It does not require any Odoo module installation or customisation. It communicates via Odoo\'s built-in standard XML-RPC API.', 0),
    bullet('It does not support Odoo Community Edition helpdesk/maintenance (those modules are Enterprise only). Shadow gracefully shows a message if a module is unavailable.', 0),
    new Paragraph({ children: [new PageBreak()] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
const sec2 = [
    heading1('Section 2 — Architecture  (Technical Reference)'),

    heading2('2.1  System Overview'),
    para([txt('Shadow is composed of three distinct layers that communicate over HTTPS:')]),
    bullet('Mobile App (React Native / Expo) — Runs natively on Android. Communicates with the backend exclusively via the REST API.', 0, true),
    bullet('Backend API (Node.js / Express / Vercel Serverless) — Stateless, JWT-authenticated REST API. Bridges mobile to Odoo and Redis.', 0, true),
    bullet('Data Layer (Upstash Redis + Odoo XML-RPC) — Redis stores push tokens, notification history, and tenant configuration. Odoo is the authoritative source for all ERP data.', 0, true),
    spacer(8),

    heading2('2.2  Technology Stack'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2200, 4000, 3160],
        rows: [
            new TableRow({ children: [headerCell('Layer', 2200), headerCell('Technology', 4000), headerCell('Version / Notes', 3160)] }),
            ...([
                ['Mobile Frontend', 'React Native + Expo Router', 'Expo SDK 54, React 19'],
                ['Styling', 'NativeWind (Tailwind for RN)', 'Custom useColor hook, dark/light tokens'],
                ['Navigation', 'Expo Router (file-based)', 'Tab + nested stack navigation'],
                ['Backend Framework', 'Express.js on Vercel Serverless', 'Node 18+, deployed globally'],
                ['Language', 'TypeScript', 'Strict mode, frontend and backend'],
                ['Authentication', 'JSON Web Tokens (JWT)', 'HS256 algorithm, 30-day expiry'],
                ['Push Notifications', 'Expo Push Notification Service', 'ExponentPushToken format'],
                ['Cache / Store', 'Upstash Redis REST API', 'Notifications, push tokens, tenant config'],
                ['Odoo Integration', 'XML-RPC via custom OdooClient', 'v15, v16, v17 compatible'],
                ['Validation', 'Zod v4', 'All backend route inputs validated'],
                ['Testing', 'Jest + ts-jest + supertest', '157 backend + 85 frontend tests'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2200, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 4000, i % 2 === 0 ? C.white : 'F8FAFC', C.black),
                        dataCell(c, 3160, i % 2 === 0 ? C.white : 'F8FAFC', C.slate),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('2.3  Backend File Structure'),
    ...codeBlock([
        'backend/',
        '  src/',
        '    index.ts           Express app entry, route mounting, JWT middleware',
        '    config.ts          Environment variable loading (process.exit if missing)',
        '    odoo/',
        '      client.ts        OdooClient factory: authenticate, searchRead,',
        '                       createRecord, uploadAttachments',
        '    lib/',
        '      tenantStore.ts   CRUD for tenant configs in Redis',
        '      notificationStore.ts  Notification CRUD, mark-read, scoped keys',
        '      pushStore.ts     Push token save/get/remove, Expo push delivery',
        '      requestMonitor.ts  Polls Odoo for state changes → notifications',
        '      redis.ts         Thin fetch wrapper for Upstash REST API',
        '    routes/',
        '      auth.ts          Login, tenant lookup, push token, admin tenants',
        '      time_off.ts      Time-off CRUD + leave type field probe chain',
        '      expenses.ts      Expense CRUD + product lookup with fallback',
        '      timesheet.ts     Timesheet entries, projects, tasks',
        '      helpdesk.ts      Helpdesk tickets + availability check',
        '      maintenance.ts   Maintenance requests + availability check',
        '      notifications.ts Notification fetch + mark-read endpoints',
    ]),

    heading2('2.4  Frontend File Structure'),
    ...codeBlock([
        'production-version/',
        '  app/',
        '    login.tsx                  Two-step login (company code > employee ID + PIN)',
        '    (app)/',
        '      dashboard.tsx            Home screen with quick stats and action cards',
        '      new-request.tsx          Hub for all 4 request types + timesheet',
        '      notifications.tsx        Notification list with mark-read',
        '      request-details.tsx      Detail view for any request type (all 5)',
        '      settings.tsx             Push toggle, mark-all-read, cache, sign-out',
        '      timesheet.tsx            Timesheet list and entry creation',
        '  providers/',
        '    auth-context.tsx           SessionProvider: JWT, tenant state, push registration',
        '    toast-context.tsx          Global toast notification system',
        '  api/',
        '    client.ts                  All API calls, fetch wrapper, 401 auto-signout',
        '  hooks/',
        '    useColor.ts                Theme colour resolver (dark/light aware)',
        '  constants.ts                 API_URL pointing to deployed Vercel backend',
    ]),

    heading2('2.5  Multi-Tenancy Architecture'),
    para([txt('Every piece of data in Redis is stored under a tenant-scoped key. There is no shared data pool.')]),
    ...codeBlock([
        'Redis key pattern:  shadow:t:{tenantId}:{resource}',
        '',
        'Examples:',
        '  shadow:t:acmecorp:tenant              Tenant config (Odoo credentials)',
        '  shadow:t:acmecorp:notifications       All notifications for this tenant',
        '  shadow:t:acmecorp:push:42             Push token for employee #42',
        '  shadow:t:acmecorp:req_cache:42        Request state cache for employee #42',
        '',
        'JWT payload:  { id, name, role, tenantId }',
        '  tenantId is extracted from the JWT on every request and used to:',
        '    1. Load the correct Odoo credentials from Redis',
        '    2. Scope all Redis reads/writes',
        '    3. Create an isolated OdooClient instance',
    ]),

    heading2('2.6  Odoo Version Compatibility'),
    para([txt('Shadow is tested against Odoo v15, v16, and v17. The following compatibility strategies are used:')]),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2800, 6560],
        rows: [
            new TableRow({ children: [headerCell('Scenario', 2800), headerCell('Shadow\'s Strategy', 6560)] }),
            ...([
                ['Leave type field (v15 vs v17)', 'Probes candidates in order: work_entry_type_id (v17) then holiday_status_id (v15/v16). Result cached per tenant.'],
                ['Expense total_amount_currency', 'Creates expense with the field; if Odoo returns "Invalid field", retries without it silently.'],
                ['Helpdesk module availability', 'Probes helpdesk.ticket model on every request. Returns available:false gracefully if not installed.'],
                ['Maintenance module availability', 'Same probe strategy as helpdesk — no crash, just a friendly unavailable message.'],
                ['Analytic account for timesheets', 'Tries to fetch analytic_account_id from project. Silently skips if field does not exist in this Odoo version.'],
                ['Custom fields (x_ prefix)', 'Pass-through — any field returned by Odoo searchRead is included in the API response, including all x_* custom fields.'],
            ].map(([a, b], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2800, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 6560, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('2.7  Authentication Flow'),
    para([txt('Five steps from app launch to authenticated session:')]),
    numbered('User enters company code → GET /auth/tenant/:slug → backend reads tenant from Redis → returns company name and HR email to the app.'),
    numbered('User enters Employee ID + PIN → POST /auth/login → backend retrieves Odoo credentials from Redis → calls Odoo XML-RPC authenticate() → Odoo verifies the PIN.'),
    numbered('On success, backend signs a JWT containing { id, name, role, tenantId } and returns it to the app.'),
    numbered('App stores JWT in AsyncStorage. All subsequent API requests include the header: Authorization: Bearer {jwt}'),
    numbered('If any endpoint returns HTTP 401, the app\'s apiFetch wrapper automatically calls signOut() to clear the session and return the user to the login screen.'),
    spacer(8),

    heading2('2.8  Environment Variables'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3200, 1200, 4960],
        rows: [
            new TableRow({ children: [headerCell('Variable', 3200), headerCell('Required', 1200), headerCell('Description', 4960)] }),
            ...([
                ['JWT_SECRET', 'Yes', 'Secret string for signing and verifying JWTs. Use a minimum 32-character random string. Never commit to source control.'],
                ['ADMIN_SECRET', 'Yes', 'Secret passed in the x-admin-secret header to access /admin/* endpoints. Keep this very secure.'],
                ['UPSTASH_REDIS_REST_URL', 'Yes', 'The REST URL of your Upstash Redis instance (e.g. https://xxx.upstash.io).'],
                ['UPSTASH_REDIS_REST_TOKEN', 'Yes', 'The REST authentication token for your Upstash Redis instance.'],
                ['PORT', 'No', 'Local development port. Defaults to 3000. Not used on Vercel.'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 3200, i % 2 === 0 ? C.white : 'F8FAFC', '7C3AED', true),
                        dataCell(b, 1200, b === 'Yes' ? 'D1FAE5' : 'FEF3C7', b === 'Yes' ? '065F46' : 'D97706', true),
                        dataCell(c, 4960, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('2.9  API Endpoints Reference'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [900, 3100, 1400, 3960],
        rows: [
            new TableRow({ children: [headerCell('Method', 900), headerCell('Endpoint', 3100), headerCell('Auth', 1400), headerCell('Description', 3960)] }),
            ...([
                ['GET',    '/auth/tenant/:slug',      'None',         'Look up tenant by company code'],
                ['POST',   '/auth/login',             'None',         'Login with employee ID + PIN — returns JWT'],
                ['POST',   '/auth/push-token',        'JWT',          'Register Expo push notification token'],
                ['DELETE', '/auth/push-token',        'JWT',          'Remove Expo push notification token'],
                ['GET',    '/admin/tenants',          'Admin Secret', 'List all registered tenants'],
                ['POST',   '/admin/tenants',          'Admin Secret', 'Register or update a tenant'],
                ['GET',    '/time-off',               'JWT',          'List employee time-off requests'],
                ['GET',    '/time-off/types',         'JWT',          'List available leave types'],
                ['GET',    '/time-off/pending',       'JWT',          'List pending (unapproved) leaves'],
                ['POST',   '/time-off',               'JWT',          'Submit a new time-off request'],
                ['GET',    '/expenses',               'JWT',          'List employee expenses'],
                ['GET',    '/expenses/pending',       'JWT',          'List draft or reported expenses'],
                ['GET',    '/expenses/products',      'JWT',          'List expense-able products'],
                ['POST',   '/expenses',               'JWT',          'Create a new expense claim'],
                ['GET',    '/timesheet',              'JWT',          'List timesheet entries for employee'],
                ['GET',    '/timesheet/projects',     'JWT',          'List active projects'],
                ['GET',    '/timesheet/tasks',        'JWT',          'List tasks for a given project_id'],
                ['POST',   '/timesheet',              'JWT',          'Create a timesheet entry'],
                ['GET',    '/helpdesk/teams',         'JWT',          'List helpdesk teams (includes availability check)'],
                ['GET',    '/helpdesk',               'JWT',          'List employee helpdesk tickets'],
                ['POST',   '/helpdesk',               'JWT',          'Create a helpdesk ticket'],
                ['GET',    '/maintenance/categories', 'JWT',          'List maintenance categories'],
                ['GET',    '/maintenance',            'JWT',          'List employee maintenance requests'],
                ['POST',   '/maintenance',            'JWT',          'Create a maintenance request'],
                ['GET',    '/notifications',          'JWT',          'Fetch notifications (triggers Odoo sync)'],
                ['PUT',    '/notifications/:id/read', 'JWT',          'Mark a single notification as read'],
                ['PUT',    '/notifications/read-all', 'JWT',          'Mark all employee notifications as read'],
            ].map(([method, endpoint, auth, desc], i) => {
                const methodColor = method === 'GET' ? '065F46' : method === 'POST' ? '1D4ED8' : method === 'DELETE' ? 'B91C1C' : '92400E';
                const methodFill  = method === 'GET' ? 'D1FAE5' : method === 'POST' ? 'DBEAFE' : method === 'DELETE' ? 'FEE2E2' : 'FEF3C7';
                return new TableRow({
                    children: [
                        dataCell(method, 900, methodFill, methodColor, true),
                        dataCell(endpoint, 3100, i % 2 === 0 ? C.white : 'F8FAFC', '7C3AED'),
                        dataCell(auth, 1400, auth === 'None' ? 'FEF3C7' : auth === 'JWT' ? 'EFF6FF' : 'FEE2E2', auth === 'None' ? 'B45309' : auth === 'JWT' ? '1D4ED8' : 'B91C1C'),
                        dataCell(desc, 3960, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                });
            })),
        ],
    }),
    spacer(16),

    heading2('2.10  Running the Test Suite'),
    heading3('Backend Tests (from backend/ directory)'),
    ...codeBlock([
        'npm test                  Run all 157 unit + route tests',
        'npm run test:coverage     Run tests with HTML coverage report',
        'npm run smoke             Run full end-to-end smoke test against live backend',
        '',
        '# Smoke test environment variables:',
        'SMOKE_TENANT=yourslug  SMOKE_EMP_ID=1  SMOKE_PIN=1234  \\',
        'SMOKE_ADMIN_SECRET=yourkey  npm run smoke',
    ]),
    heading3('Frontend Tests (from production-version/ directory)'),
    ...codeBlock([
        'npm test                  Run all 85 API client and business logic tests',
    ]),
    para([txt('Test coverage breakdown:')]),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3600, 2880, 2880],
        rows: [
            new TableRow({ children: [headerCell('Test Suite', 3600), headerCell('Tests', 2880), headerCell('Covers', 2880)] }),
            ...([
                ['unit/tenantStore.test.ts', '8', 'Redis CRUD for tenant config'],
                ['unit/notificationStore.test.ts', '8', 'Notification store, tenant isolation'],
                ['unit/pushStore.test.ts', '9', 'Push tokens, Expo delivery'],
                ['routes/auth.test.ts', '18', 'Login, tenant lookup, JWT protection'],
                ['routes/timeOff.test.ts', '14', 'Leave requests, probe chain'],
                ['routes/expenses.test.ts', '17', 'Expense CRUD, product fallback'],
                ['routes/helpdesk.test.ts', '16', 'Tickets, availability, attachments'],
                ['routes/maintenance.test.ts', '17', 'Requests, availability, module check'],
                ['routes/timesheet.test.ts', '18', 'Entries, projects, tasks, analytic'],
                ['routes/notifications.test.ts', '12', 'Fetch, mark-read, tenant isolation'],
                ['Frontend: login.test.tsx', '11', 'Company code + login flow'],
                ['Frontend: notifications.test.tsx', '9', 'Fetch, mark-read, sorting'],
                ['Frontend: settings.test.tsx', '10', 'Push tokens, cache, persistence'],
                ['Frontend: newRequest.test.tsx', '22', 'All 4 submission flows + validation'],
                ['Frontend: requestDetails.test.tsx', '21', 'All 5 types, status/label helpers'],
                ['Frontend: timesheet.test.tsx', '12', 'Entries, projects, tasks, hours'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 3600, i % 2 === 0 ? C.white : 'F8FAFC', '7C3AED'),
                        dataCell(b, 2880, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(c, 2880, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('2.11  Deployment'),
    heading3('Backend — Vercel'),
    numbered('Connect the GitHub repository to a Vercel project.'),
    numbered('In Vercel project settings → Environment Variables, add: JWT_SECRET, ADMIN_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.'),
    numbered('Every push to the main branch triggers an automatic deployment.'),
    numbered('The vercel.json file routes all traffic through the Express app.'),
    spacer(6),
    heading3('Frontend — EAS Build'),
    ...codeBlock([
        '# Install EAS CLI',
        'npm install -g eas-cli',
        '',
        '# Authenticate with Expo account',
        'eas login',
        '',
        '# Build APK for testing (sideloadable)',
        'cd production-version',
        'eas build --platform android --profile preview',
        '',
        '# Build AAB for Google Play Store submission',
        'eas build --platform android --profile production',
    ]),
    new Paragraph({ children: [new PageBreak()] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — INSTALLATION & TESTING GUIDE
// ─────────────────────────────────────────────────────────────────────────────
const sec3 = [
    heading1('Section 3 — Installation & Feature Testing Guide  (Android APK)'),

    heading2('3.1  Downloading and Installing the APK'),
    callout('Before You Begin', [
        'You need an Android phone running Android 8.0 (Oreo) or later.',
        'The APK download link will be provided by your Shadow administrator.',
        'Make sure you have a stable internet connection during the install.',
    ], C.steel, C.blue, C.blue2),
    spacer(8),

    heading3('Step 1 — Enable Unknown Sources'),
    para([txt('Android blocks installations from outside the Play Store by default. Enable it:')]),
    numbered('Open the Settings app on your Android phone.'),
    numbered('Go to Security (or Privacy on Android 12+, or Apps on some Samsung devices).'),
    numbered('Find Install Unknown Apps or Unknown Sources and enable it.'),
    numbered('On Android 8+, you will be asked per-app: enable it for your browser or file manager.'),
    spacer(6),

    heading3('Step 2 — Download the APK'),
    numbered('Open the download link in your phone\'s browser (Chrome or Firefox recommended).'),
    numbered('Tap the .apk file when the download finishes.'),
    numbered('If a warning says "This type of file can harm your device", tap OK or Download anyway.'),
    spacer(6),

    heading3('Step 3 — Install Shadow'),
    numbered('Tap the downloaded .apk file (check your notifications or Downloads folder).'),
    numbered('Tap Install when the Android installer screen appears.'),
    numbered('Wait for the installation to complete (usually under 30 seconds).'),
    numbered('Tap Open to launch Shadow immediately.'),
    spacer(8),

    heading2('3.2  First Launch — Company Setup'),
    para([txt('The first screen you see is the Welcome screen asking for your company code.')]),
    bullet('Enter the company code given to you by your administrator (e.g. acmecorp).', 0),
    bullet('Tap Continue.', 0),
    bullet('If successful: your company name appears and you are taken to the Sign In screen.', 0),
    bullet('If not found: double-check the code (it is case-insensitive) or contact HR.', 0),
    spacer(4),
    callout('Note', ['The company code is remembered permanently on this device. You will not need to enter it again unless you tap Change Company in Settings.'], C.warn, C.warnDk, C.warnDk),
    spacer(8),

    heading2('3.3  Signing In'),
    bullet('Employee ID: Your numeric Odoo employee ID. Find it in Odoo → Employees → your name — the number in the URL (e.g. /web#id=42).', 0),
    bullet('PIN: The PIN set in your Odoo employee profile under HR Settings tab → PIN field.', 0),
    bullet('Tap Sign In. On success you land on the Dashboard.', 0),
    spacer(8),

    heading2('3.4  Feature Testing Checklist'),
    para([txt('Work through each feature in order. Each checklist item should pass before moving to the next section.', { bold: true })]),
    spacer(4),

    heading3('Feature 1 — Dashboard'),
    checkbox('Dashboard loads showing your name and a summary of pending items'),
    checkbox('Quick-action cards are visible (New Request, Timesheet, etc.)'),
    checkbox('Navigation tabs appear at the bottom of the screen'),
    spacer(8),

    heading3('Feature 2 — Time Off Request'),
    checkbox('Tap New Request and select Time Off'),
    checkbox('Choose a leave type from the dropdown list'),
    checkbox('Select a start date using the date picker'),
    checkbox('Select an end date using the date picker'),
    checkbox('Optionally type a reason in the description field'),
    checkbox('Optionally tap the attachment icon and attach a PDF or image (up to 3 files)'),
    checkbox('Tap Submit — a green success toast should appear'),
    checkbox('Open Odoo → Time Off → verify the request appears in Draft/Pending state'),
    spacer(8),

    heading3('Feature 3 — Expense Claim'),
    checkbox('Tap New Request and select Expense Claim'),
    checkbox('Choose an expense category/product from the dropdown'),
    checkbox('Enter the amount'),
    checkbox('Enter a description (e.g. Hotel Paris)'),
    checkbox('Select the expense date'),
    checkbox('Optionally attach a receipt photo (up to 3 images)'),
    checkbox('Tap Submit — success toast should appear'),
    checkbox('Open Odoo → Expenses → verify the claim appears in Draft state'),
    spacer(8),

    heading3('Feature 4 — Timesheet'),
    checkbox('Tap the Timesheet tab at the bottom of the screen'),
    checkbox('Existing entries are shown, sorted by date newest first'),
    checkbox('Tap the + button to add a new entry'),
    checkbox('Select a project from the dropdown'),
    checkbox('Optionally select a task from the dropdown'),
    checkbox('Enter a date, number of hours (e.g. 2.5), and a work description'),
    checkbox('Tap Save — success toast should appear'),
    checkbox('Open Odoo → Timesheets → verify the entry appears under account.analytic.line'),
    spacer(8),

    heading3('Feature 5 — IT Support Ticket'),
    checkbox('Tap New Request and select IT Support'),
    checkbox('If the Helpdesk module is not installed in Odoo, an Unavailable message will appear — this is expected'),
    checkbox('If available: enter a subject (required) — e.g. Cannot access payroll system'),
    checkbox('Optionally enter a description and select a team'),
    checkbox('Optionally attach a screenshot'),
    checkbox('Tap Submit — success toast should appear'),
    checkbox('Open Odoo → Helpdesk → verify the ticket appears in New/Open stage'),
    spacer(8),

    heading3('Feature 6 — Maintenance Request'),
    checkbox('Tap New Request and select Maintenance'),
    checkbox('If the Maintenance module is not installed in Odoo, an Unavailable message will appear — expected'),
    checkbox('If available: enter a request title (required) — e.g. Fix broken AC in room 301'),
    checkbox('Optionally enter a description and select a category'),
    checkbox('Choose request type: Corrective or Preventive'),
    checkbox('Optionally attach photos of the issue'),
    checkbox('Tap Submit — success toast should appear'),
    checkbox('Open Odoo → Maintenance → verify the request appears'),
    spacer(8),

    heading3('Feature 7 — Notifications'),
    checkbox('Tap the bell icon or Notifications tab'),
    checkbox('Notification list loads (may be empty on first use — this is normal)'),
    checkbox('In Odoo, have a manager approve or reject one of the requests you just submitted'),
    checkbox('Pull down to refresh the notifications screen in Shadow'),
    checkbox('The approval or rejection notification should appear within seconds'),
    checkbox('Tap the notification to mark it as read (it changes appearance)'),
    spacer(8),

    heading3('Feature 8 — Push Notifications'),
    checkbox('When signing in for the first time, tap Allow when prompted for notification permissions'),
    checkbox('Push notifications require a real physical Android device (not an emulator/simulator)'),
    checkbox('In Odoo, have a manager approve a pending request'),
    checkbox('Within a few minutes, a push notification should appear in your Android notification drawer'),
    checkbox('Tapping the notification opens Shadow'),
    spacer(8),

    heading3('Feature 9 — Request Details'),
    checkbox('Tap any notification in the list — it should open a detail view for that request'),
    checkbox('The detail view shows the request type, status badge, dates/amounts, and full details'),
    checkbox('The status badge correctly shows Approved (green), Rejected (red), or Pending (orange)'),
    checkbox('Tap Back to return to the notifications list'),
    spacer(8),

    heading3('Feature 10 — Settings'),
    checkbox('Open Settings via the profile icon or bottom tab'),
    checkbox('Toggle Push Notifications OFF — confirm no new push notifications arrive'),
    checkbox('Toggle Push Notifications back ON — confirm push notifications resume'),
    checkbox('Tap Mark All as Read — all notifications should show as read'),
    checkbox('Tap Clear App Cache — a success message should appear'),
    checkbox('Tap Change Company — the app should return to the company code entry screen'),
    checkbox('Re-enter the company code and sign in again to confirm it still works'),
    checkbox('Tap Sign Out — the app should return to the Sign In screen (company code is remembered)'),
    spacer(16),

    heading2('3.5  Troubleshooting Common Issues'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2800, 3000, 3560],
        rows: [
            new TableRow({ children: [headerCell('Problem', 2800), headerCell('Likely Cause', 3000), headerCell('Solution', 3560)] }),
            ...([
                ['Company code not found', 'Code is wrong or company not yet registered', 'Contact Shadow administrator. Verify the exact code (case-insensitive).'],
                ['Login fails with wrong credentials', 'Incorrect Employee ID or PIN', 'Check your Employee ID in Odoo (the number in the URL). Ask HR to verify your PIN.'],
                ['No leave types showing', 'Odoo connection issue or no types configured', 'Ensure leave types are configured in Odoo → Configuration → Leave Types.'],
                ['Helpdesk shows Unavailable', 'Helpdesk module not installed in Odoo', 'Ask your Odoo admin to install the Helpdesk Enterprise module.'],
                ['Maintenance shows Unavailable', 'Maintenance module not installed in Odoo', 'Ask your Odoo admin to install the Maintenance module.'],
                ['Push notifications not arriving', 'EAS projectId not configured or emulator', 'Use a real physical device. Ensure push notifications are enabled in Settings.'],
                ['App crashes on open', 'Corrupted install or incompatible Android version', 'Uninstall Shadow, restart your phone, then reinstall the APK.'],
                ['Requests not appearing in Odoo', 'Network error during submission', 'Check your internet connection and try submitting again.'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2800, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 3000, i % 2 === 0 ? C.white : 'F8FAFC', C.slate),
                        dataCell(c, 3560, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — ADMIN SETUP GUIDE
// ─────────────────────────────────────────────────────────────────────────────
const sec4 = [
    heading1('Section 4 — Admin Setup Guide — Registering a New Company'),

    heading2('4.1  Information to Collect from the New Client'),
    para([txt('Before the Shadow administrator can register a company, the client must provide the following details. Collect them via a secure channel — never ask for passwords over email in plain text.')]),
    spacer(4),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2400, 3600, 3360],
        rows: [
            new TableRow({ children: [headerCell('Field', 2400), headerCell('Description', 3600), headerCell('Example', 3360)] }),
            ...([
                ['Company Code (slug)', 'Short unique identifier. Lowercase letters and numbers only, no spaces. This is what employees type on first launch.', 'acmecorp  /  globaltrade  /  myco'],
                ['Company Display Name', 'Full company name shown in the app to employees.', 'Acme Corporation'],
                ['HR Email Address', 'Email displayed to employees who are locked out of their account (PIN reset).', 'hr@acmecorp.com'],
                ['Odoo URL', 'Full URL of the Odoo instance including https://', 'https://acmecorp.odoo.com'],
                ['Odoo Database Name', 'The Odoo database name (visible on the login screen of Odoo).', 'acmecorp_prod'],
                ['Odoo API Username', 'Email of an Odoo user with API and model access (see 4.2 for required permissions).', 'shadow_api@acmecorp.com'],
                ['Odoo API Password', 'Password for the above Odoo user. Share via a secure channel (password manager link).', '(provide securely)'],
                ['Odoo Version', 'The Odoo version the client is running.', '15  /  16  /  17'],
            ].map(([a, b, c], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2400, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 3600, i % 2 === 0 ? C.white : 'F8FAFC'),
                        dataCell(c, 3360, i % 2 === 0 ? C.white : 'F8FAFC', C.slate),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('4.2  Odoo API User — Required Permissions'),
    para([txt('The Odoo API user should have the following model-level access rights. The easiest way is to create a dedicated user with the Employee and HR Officer (or HR Manager) roles, plus read/write on the specific models below.')]),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3200, 1400, 1400, 3360],
        rows: [
            new TableRow({ children: [headerCell('Odoo Model', 3200), headerCell('Read', 1400), headerCell('Write', 1400), headerCell('Notes', 3360)] }),
            ...([
                ['hr.employee',                    'Yes', 'No',  'Used to look up employee ID, name, company, and user link'],
                ['hr.leave + hr.leave.type',       'Yes', 'Yes', 'Time off requests and leave type configuration'],
                ['hr.expense',                     'Yes', 'Yes', 'Expense claims submission and status tracking'],
                ['account.analytic.line',          'Yes', 'Yes', 'Timesheet entries (requires Timesheets module)'],
                ['project.project + project.task', 'Yes', 'No',  'Project and task lists for timesheet entry'],
                ['helpdesk.ticket + helpdesk.team','Yes', 'Yes', 'IT support tickets (Enterprise Helpdesk module required)'],
                ['maintenance.request + category', 'Yes', 'Yes', 'Maintenance requests (Maintenance module required)'],
                ['res.users + res.partner',        'Yes', 'No',  'Used to resolve employee to helpdesk partner link'],
                ['res.company + product.*',        'Yes', 'No',  'Company currency + expense product lookup'],
                ['ir.attachment',                  'Yes', 'Yes', 'File and image attachments on all request types'],
            ].map(([a, b, c, d], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 3200, i % 2 === 0 ? C.white : 'F8FAFC', '7C3AED'),
                        dataCell(b, 1400, b === 'Yes' ? 'D1FAE5' : C.white, b === 'Yes' ? '065F46' : C.slate, true),
                        dataCell(c, 1400, c === 'Yes' ? 'D1FAE5' : 'FEF9C3', c === 'Yes' ? '065F46' : '92400E', true),
                        dataCell(d, 3360, i % 2 === 0 ? C.white : 'F8FAFC', C.slate),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('4.3  Registering the Company via the Admin API'),
    para([txt('Once you have all the information, register the company using the Shadow Admin API endpoint. The admin secret must be kept confidential.')]),
    spacer(4),
    callout('API Endpoint', [
        'POST  https://erp-external-app.vercel.app/admin/tenants',
        'Header:  x-admin-secret: {your_admin_secret}',
        'Content-Type: application/json',
    ], C.steel, C.blue, C.blue2),
    spacer(8),
    para([txt('Request body (JSON):')]),
    ...codeBlock([
        '{',
        '  "slug":      "acmecorp",',
        '  "name":      "Acme Corporation",',
        '  "hr_email":  "hr@acmecorp.com",',
        '  "odoo_url":  "https://acmecorp.odoo.com",',
        '  "odoo_db":   "acmecorp_prod",',
        '  "odoo_user": "shadow_api@acmecorp.com",',
        '  "odoo_pass": "securepassword123"',
        '}',
    ]),
    para([txt('Successful response:')]),
    ...codeBlock([
        '{ "success": true, "slug": "acmecorp" }',
    ]),
    spacer(8),
    callout('Updating a Tenant', [
        'To update an existing tenant (e.g. change password or HR email), send the same POST request with the same slug.',
        'The registration is idempotent — it will overwrite the existing config for that slug.',
    ], C.warn, C.warnDk, C.warnDk),
    spacer(12),

    heading2('4.4  Verifying the Registration'),
    numbered('Open Shadow on an Android device.'),
    numbered('Enter the company code (e.g. acmecorp). Your company name should appear — this confirms the slug is registered correctly.'),
    numbered('Log in with a valid employee ID and PIN.'),
    numbered('Navigate to New Request → Time Off and verify the leave types load correctly.'),
    numbered('Submit a test time-off request and verify it appears in Odoo.'),
    numbered('Optional: Check all other features (Expenses, Timesheet, Helpdesk, Maintenance).'),
    spacer(8),

    heading2('4.5  Employee Onboarding Instructions'),
    para([txt('Once the company is registered, share the following information with the client to pass on to their employees:')]),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2400, 6960],
        rows: [
            new TableRow({ children: [headerCell('Information', 2400), headerCell('What to Tell the Employee', 6960)] }),
            ...([
                ['APK Download Link', 'Share the EAS build URL or a direct link to the .apk file hosted by you.'],
                ['Company Code', 'The slug registered in step 4.3 (e.g. acmecorp). Case-insensitive.'],
                ['Employee ID', 'Found in Odoo → Employees → click on the employee → look at the number in the browser URL bar (e.g. /web#id=42, so ID = 42).'],
                ['PIN', 'Set by the Odoo HR administrator. Employees → HR Settings tab → PIN field. 4-6 numeric digits.'],
            ].map(([a, b], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 2400, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 6960, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('4.6  Odoo PIN Setup — Step-by-Step for HR Managers'),
    para([txt('Each employee must have a PIN set in Odoo before they can use Shadow. Here is how to set it:')]),
    numbered('Log in to Odoo as an HR Manager or Administrator.'),
    numbered('Go to the Employees module.'),
    numbered('Click on the employee\'s name.'),
    numbered('Click the HR Settings tab (along the top of the employee form).'),
    numbered('Find the PIN field and enter a 4-6 digit numeric PIN.'),
    numbered('Click Save.'),
    numbered('Repeat for each employee who will use Shadow.'),
    spacer(4),
    callout('Important Security Note', [
        'Employees cannot change their own PIN from within Shadow.',
        'Only HR Managers and Odoo Administrators can set or change PINs.',
        'If an employee is locked out, they should contact HR who will update the PIN in Odoo.',
        'There is no PIN reset flow inside Shadow — this is intentional for security.',
    ], 'FEE2E2', 'B91C1C', 'B91C1C'),
    new Paragraph({ children: [new PageBreak()] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — SECURITY NOTES
// ─────────────────────────────────────────────────────────────────────────────
const sec5 = [
    heading1('Section 5 — Security Notes'),

    heading2('5.1  Data Security'),
    new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
            new TableRow({ children: [headerCell('Area', 3000), headerCell('How Shadow Protects It', 6360)] }),
            ...([
                ['Transport Security', 'All communication between app, backend, and Upstash Redis uses HTTPS/TLS. No plaintext connections.'],
                ['JWT Storage', 'Tokens are stored in AsyncStorage on-device. JWTs expire after 30 days. A 401 response auto-revokes the session.'],
                ['Employee PINs', 'PINs are never stored or logged by Shadow. They are passed directly to Odoo XML-RPC and discarded immediately after authentication.'],
                ['Odoo Credentials', 'Odoo URL, database, username, and password are stored in Upstash Redis with full TLS encryption. Never in source code or environment variables visible to the app.'],
                ['ERP Data Storage', 'No ERP data (leave records, expense records, timesheets) is stored permanently in Shadow. All data is fetched live from Odoo on demand and held only in device memory.'],
                ['Tenant Isolation', 'Every Redis key includes the tenantId prefix. Every JWT includes a tenantId claim verified on every API call. One tenant cannot access another\'s data under any circumstances.'],
                ['Admin Endpoints', 'The /admin/* endpoints are protected by a separate x-admin-secret header. Even a valid user JWT cannot access admin routes.'],
            ].map(([a, b], i) =>
                new TableRow({
                    children: [
                        dataCell(a, 3000, i % 2 === 0 ? C.white : 'F8FAFC', C.navy, true),
                        dataCell(b, 6360, i % 2 === 0 ? C.white : 'F8FAFC'),
                    ],
                })
            )),
        ],
    }),
    spacer(16),

    heading2('5.2  Responsible Disclosure'),
    para([txt('If you discover a security vulnerability in Shadow:')]),
    numbered('Contact the Shadow administrator immediately via a private, secure channel.'),
    numbered('Do not disclose the vulnerability publicly until a fix has been deployed.'),
    numbered('Provide as much detail as possible: steps to reproduce, affected endpoints, and potential impact.'),
    numbered('A fix will be acknowledged and deployed as a priority.'),
    spacer(16),

    heading2('5.3  Security Recommendations for Clients'),
    bullet('Use a dedicated Odoo API user for Shadow — do not use your personal admin account.', 0),
    bullet('Grant the API user only the minimum required permissions listed in Section 4.2.', 0),
    bullet('Store the Odoo API password in a password manager before sharing it with the Shadow administrator.', 0),
    bullet('If the Odoo API user password changes, update the tenant registration immediately via the Admin API (Section 4.3).', 0),
    bullet('Regularly audit which employees have access to Shadow in Odoo (ensure terminated employees have their records deactivated in Odoo, which instantly blocks their Shadow access).', 0),
    spacer(16),

    hr(),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: 'Shadow v1.0  |  Built with Expo SDK 54 + Node.js + Odoo XML-RPC  |  Documentation Generated 2026', font: 'Arial', size: 18, color: C.muted })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Backend: 157 Tests Passing  |  Frontend: 85 Tests Passing  |  Supports Odoo v15, v16, v17', font: 'Arial', size: 18, color: C.muted })],
    }),
];

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT ASSEMBLY
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
    numbering: {
        config: [
            {
                reference: 'bullets',
                levels: [{
                    level: 0, format: LevelFormat.BULLET, text: '\u2022',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 600, hanging: 300 } } },
                }, {
                    level: 1, format: LevelFormat.BULLET, text: '\u25E6',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 1000, hanging: 300 } } },
                }],
            },
            {
                reference: 'numbers',
                levels: [{
                    level: 0, format: LevelFormat.DECIMAL, text: '%1.',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 600, hanging: 300 } } },
                }],
            },
            {
                reference: 'checkboxes',
                levels: [{
                    level: 0, format: LevelFormat.BULLET, text: '\u25A1',
                    alignment: AlignmentType.LEFT,
                    style: {
                        run: { font: 'Arial', size: 22 },
                        paragraph: { indent: { left: 600, hanging: 300 } },
                    },
                }],
            },
        ],
    },
    styles: {
        default: {
            document: { run: { font: 'Arial', size: 22, color: C.black } },
        },
        paragraphStyles: [
            {
                id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 36, bold: true, font: 'Arial', color: C.navy },
                paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 },
            },
            {
                id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 28, bold: true, font: 'Arial', color: C.navy },
                paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 },
            },
            {
                id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 24, bold: true, font: 'Arial', color: C.blue },
                paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
            },
        ],
    },
    sections: [{
        properties: {
            page: {
                size: { width: 12240, height: 15840 },
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
        },
        headers: {
            default: new Header({
                children: [new Paragraph({
                    children: [
                        new TextRun({ text: 'Shadow — Complete Documentation', font: 'Arial', size: 18, color: C.slate }),
                        new TextRun({ text: '\t', font: 'Arial', size: 18 }),
                        new TextRun({ text: 'v1.0 | 2026', font: 'Arial', size: 18, color: C.muted }),
                    ],
                    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
                    tabStops: [{ type: 'right', position: 8640 }],
                })],
            }),
        },
        footers: {
            default: new Footer({
                children: [new Paragraph({
                    children: [
                        new TextRun({ text: 'Shadow Mobile ERP Companion', font: 'Arial', size: 16, color: C.muted }),
                        new TextRun({ text: '\tPage ', font: 'Arial', size: 16, color: C.muted }),
                        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: C.muted }),
                    ],
                    border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
                    tabStops: [{ type: 'right', position: 8640 }],
                })],
            }),
        },
        children: [
            ...cover,
            ...sec1,
            ...sec2,
            ...sec3,
            ...sec4,
            ...sec5,
        ],
    }],
});

const OUTPUT = 'C:/Users/User1/Documents/GitHub/erp_external_app/Shadow-Full-Documentation.docx';

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUTPUT, buf);
    console.log('Written: ' + OUTPUT);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
