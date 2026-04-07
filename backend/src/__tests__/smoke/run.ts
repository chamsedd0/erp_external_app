/**
 * Shadow Portal — End-to-End Smoke Test
 *
 * Hits the REAL deployed backend at https://erp-external-app.vercel.app
 * to verify every major flow works in production.
 *
 * Usage:
 *   SMOKE_TENANT=<slug> SMOKE_EMP_ID=<id> SMOKE_PIN=<pin> \
 *   SMOKE_ADMIN_SECRET=<secret> npx ts-node src/__tests__/smoke/run.ts
 *
 * All steps are sequential and log pass/fail with ✓/✗ symbols.
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'https://erp-external-app.vercel.app';
const TENANT    = process.env.SMOKE_TENANT       ?? 'testcorp';
const EMP_ID    = process.env.SMOKE_EMP_ID       ?? '1';
const PIN       = process.env.SMOKE_PIN          ?? '1234';
const ADMIN_SECRET = process.env.SMOKE_ADMIN_SECRET ?? '';

let token = '';
let employeeId = 0;

// ── Utilities ─────────────────────────────────────────────────────────────────

async function api(path: string, options: RequestInit = {}, useAuth = true) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (useAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.headers) {
        Object.assign(headers, options.headers);
    }
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body, ok: res.ok };
}

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(label: string) {
    passCount++;
    console.log(`  ✓  ${label}`);
}

function fail(label: string, detail?: any) {
    failCount++;
    const msg = `  ✗  ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`;
    console.error(msg);
    failures.push(msg);
}

function check(label: string, condition: boolean, detail?: any) {
    if (condition) pass(label);
    else fail(label, detail);
}

function section(title: string) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ── Steps ─────────────────────────────────────────────────────────────────────

async function step1_tenantLookup() {
    section('Step 1 — Tenant lookup');
    const { status, body, ok } = await api(`/auth/tenant/${TENANT}`, {}, false);
    check('GET /auth/tenant/:slug returns 200', status === 200, { status });
    check('Response has name field', typeof body.name === 'string', body);
    check('Response has hr_email field', typeof body.hr_email === 'string', body);
    console.log(`     Tenant: "${body.name}" | HR: ${body.hr_email}`);
}

async function step2_unknownTenant() {
    section('Step 2 — Unknown tenant returns 404');
    const { status } = await api('/auth/tenant/__nonexistent_slug_smoke_test__', {}, false);
    check('Unknown tenant returns 404', status === 404, { status });
}

async function step3_login() {
    section('Step 3 — Login');
    const { status, body } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ employee_id: EMP_ID, pin: PIN, tenant_slug: TENANT }),
    }, false);

    if (status === 200 && body.token) {
        token = body.token;
        employeeId = body.user?.id ?? parseInt(EMP_ID);
        pass('POST /auth/login returns 200 with token');
        check('Token is a non-empty string', typeof token === 'string' && token.length > 10);
        check('User id present in response', typeof body.user?.id === 'number', body.user);
        check('User has role field', ['employee', 'manager', 'admin'].includes(body.user?.role), body.user);
    } else {
        fail('POST /auth/login', { status, body });
    }
}

async function step4_protectedRoute() {
    section('Step 4 — JWT protection');
    const { status: withToken } = await api(`/time-off?employee_id=${employeeId}`);
    check('Authenticated request gets 200 (not 401)', withToken !== 401, { withToken });

    const { status: noToken } = await api(`/time-off?employee_id=${employeeId}`, {}, false);
    check('Unauthenticated request gets 401', noToken === 401, { noToken });
}

async function step5_timeOff() {
    section('Step 5 — Time Off');
    const { status: listStatus, body: listBody } = await api(`/time-off?employee_id=${employeeId}`);
    check('GET /time-off returns 200', listStatus === 200, { listStatus });
    check('Response has leaves array', Array.isArray(listBody.leaves), listBody);

    const { status: typesStatus, body: typesBody } = await api('/time-off/types');
    check('GET /time-off/types returns 200', typesStatus === 200, { typesStatus });
    check('Response has types array', Array.isArray(typesBody.types), typesBody);

    const { status: pendingStatus } = await api('/time-off/pending');
    check('GET /time-off/pending returns 200', pendingStatus === 200, { pendingStatus });
}

async function step6_expenses() {
    section('Step 6 — Expenses');
    const { status: listStatus, body: listBody } = await api(`/expenses?employee_id=${employeeId}`);
    check('GET /expenses returns 200', listStatus === 200, { listStatus });
    check('Response has expenses array', Array.isArray(listBody.expenses), listBody);

    const { status: productsStatus, body: productsBody } = await api('/expenses/products');
    check('GET /expenses/products returns 200', productsStatus === 200, { productsStatus });
    check('Response has products array', Array.isArray(productsBody.products), productsBody);
}

async function step7_timesheet() {
    section('Step 7 — Timesheet');
    const { status: listStatus, body: listBody } = await api(`/timesheet?employee_id=${employeeId}`);
    check('GET /timesheet returns 200', listStatus === 200, { listStatus });
    check('Response has entries array', Array.isArray(listBody.entries), listBody);

    const { status: projStatus, body: projBody } = await api('/timesheet/projects');
    check('GET /timesheet/projects returns 200', projStatus === 200, { projStatus });
    check('Response has projects array', Array.isArray(projBody.projects), projBody);
}

async function step8_helpdeskMaintenance() {
    section('Step 8 — Helpdesk & Maintenance');
    const { status: hdTeamsStatus, body: hdTeamsBody } = await api('/helpdesk/teams');
    check('GET /helpdesk/teams returns 200', hdTeamsStatus === 200, { hdTeamsStatus });
    check('Helpdesk response has available field', typeof hdTeamsBody.available === 'boolean', hdTeamsBody);

    const { status: catStatus, body: catBody } = await api('/maintenance/categories');
    check('GET /maintenance/categories returns 200', catStatus === 200, { catStatus });
    check('Maintenance response has available field', typeof catBody.available === 'boolean', catBody);
}

async function step9_notifications() {
    section('Step 9 — Notifications');
    const { status, body } = await api(`/notifications?employee_id=${employeeId}`);
    check('GET /notifications returns 200', status === 200, { status });
    check('Response has notifications array', Array.isArray(body.notifications), body);
}

async function step10_pushToken() {
    section('Step 10 — Push token registration');
    const { status: saveStatus } = await api('/auth/push-token', {
        method: 'POST',
        body: JSON.stringify({
            employee_id: employeeId,
            token: 'ExponentPushToken[smoke_test_token_do_not_use]',
            tenant_slug: TENANT,
        }),
    });
    check('POST /auth/push-token returns 200', saveStatus === 200, { saveStatus });

    const { status: delStatus } = await api('/auth/push-token', {
        method: 'DELETE',
        body: JSON.stringify({ employee_id: employeeId, tenant_slug: TENANT }),
    });
    check('DELETE /auth/push-token returns 200', delStatus === 200, { delStatus });
}

async function step11_adminApi() {
    section('Step 11 — Admin API');
    if (!ADMIN_SECRET) {
        console.log('     SMOKE_ADMIN_SECRET not set — skipping admin tests');
        return;
    }

    const { status: listStatus, body: listBody } = await api('/admin/tenants', {
        headers: { 'x-admin-secret': ADMIN_SECRET },
    });
    check('GET /admin/tenants returns 200 with admin secret', listStatus === 200, { listStatus });
    check('Response has tenants array', Array.isArray(listBody.tenants), listBody);

    const { status: noSecretStatus } = await api('/admin/tenants');
    check('GET /admin/tenants returns 401 without admin secret', noSecretStatus === 401, { noSecretStatus });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        Shadow Portal — Smoke Test Suite          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Target: ${BASE_URL}`);
    console.log(`  Tenant: ${TENANT} | Employee: ${EMP_ID}`);

    try {
        await step1_tenantLookup();
        await step2_unknownTenant();
        await step3_login();
        await step4_protectedRoute();
        await step5_timeOff();
        await step6_expenses();
        await step7_timesheet();
        await step8_helpdeskMaintenance();
        await step9_notifications();
        await step10_pushToken();
        await step11_adminApi();
    } catch (err: any) {
        fail('Unhandled exception in smoke test', err?.message ?? err);
    }

    const total = passCount + failCount;
    console.log('\n' + '═'.repeat(52));
    console.log(`  Results: ${passCount}/${total} passed, ${failCount} failed`);

    if (failures.length > 0) {
        console.log('\n  Failed steps:');
        failures.forEach(f => console.log(f));
    }

    console.log('═'.repeat(52) + '\n');
    process.exit(failCount > 0 ? 1 : 0);
}

main();
