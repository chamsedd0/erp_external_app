/**
 * Shadow Portal — End-to-End API Test Suite
 * Run: node test-api.mjs
 *
 * Tests every backend flow:
 * 1. Auth guard (401 without token)
 * 2. Login (get JWT)
 * 3. Time-off list & types
 * 4. Expenses list, pending, products
 * 5. Helpdesk tickets
 * 6. Timesheet entries, projects
 * 7. Maintenance requests
 * 8. Notifications
 */

import xmlrpc from 'xmlrpc';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';

// Load .env manually
const envPath = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD;

try {
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const [k, ...v] = line.split('=');
        const val = v.join('=').trim();
        if (k === 'ODOO_URL') ODOO_URL = val;
        if (k === 'ODOO_DB') ODOO_DB = val;
        if (k === 'ODOO_USERNAME') ODOO_USERNAME = val;
        if (k === 'ODOO_PASSWORD') ODOO_PASSWORD = val;
    }
} catch (e) {
    console.error('Could not read .env:', e.message);
    process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;
const failures = [];

function pass(label) {
    console.log(`  ✅ ${label}`);
    passCount++;
}

function fail(label, detail) {
    console.log(`  ❌ ${label}`);
    if (detail) console.log(`     └─ ${detail}`);
    failCount++;
    failures.push({ label, detail });
}

async function get(path, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE_URL}${path}`, { headers });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function post(path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ─── Odoo direct query (to get real employee barcode+pin) ─────────────────────
async function getEmployeesDirectly() {
    const url = new URL(`${ODOO_URL}/xmlrpc/2/common`);
    const commonClient = xmlrpc.createSecureClient({ url: url.href });
    const objectClient = xmlrpc.createSecureClient({ url: `${ODOO_URL}/xmlrpc/2/object` });

    const uid = await new Promise((res, rej) =>
        commonClient.methodCall('authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}],
            (e, v) => e ? rej(e) : res(v))
    );

    if (!uid) throw new Error('Odoo admin auth failed');
    console.log(`  ✅ Odoo admin authenticated (uid=${uid})`);

    const employees = await new Promise((res, rej) =>
        objectClient.methodCall('execute_kw', [
            ODOO_DB, uid, ODOO_PASSWORD,
            'hr.employee', 'search_read',
            [[]],
            { fields: ['id', 'name', 'barcode', 'pin', 'department_id', 'job_title'], limit: 10 }
        ], (e, v) => e ? rej(e) : res(v))
    );

    return { uid, employees };
}

// ─── Test runner ─────────────────────────────────────────────────────────────
async function runTests() {
    console.log('\n════════════════════════════════════════════════════');
    console.log('  Shadow Portal — API Test Suite');
    console.log('════════════════════════════════════════════════════\n');

    // ── Section 0: Odoo direct — get employees ──────────────────────────────
    console.log('[ 0 ] Odoo Direct — Employee Credentials');
    let testEmployee = null;
    try {
        const { employees } = await getEmployeesDirectly();
        if (!employees || employees.length === 0) {
            fail('Get employees from Odoo', 'No employees found in Odoo');
        } else {
            console.log(`\n  Found ${employees.length} employee(s):`);
            employees.forEach(e => {
                const barcodeInfo = e.barcode ? `barcode=${e.barcode}` : 'NO BARCODE';
                const pinInfo = e.pin ? `pin=${e.pin}` : 'NO PIN';
                console.log(`    • [id=${e.id}] ${e.name} — ${barcodeInfo}, ${pinInfo}`);
            });

            // Find an employee with both barcode and pin set
            testEmployee = employees.find(e => e.barcode && e.pin);
            if (testEmployee) {
                pass(`Found test employee: ${testEmployee.name} (id=${testEmployee.id})`);
            } else {
                fail('Find employee with barcode+pin', 'No employee has both barcode and pin set in Odoo');
                console.log('\n  ⚠️  Cannot test login without valid barcode+pin.');
                console.log('  Please set a barcode and PIN on at least one employee in Odoo backend.\n');
            }
        }
    } catch (e) {
        fail('Odoo direct connection', e.message);
        console.log('\n  ⚠️  Stopping tests — cannot reach Odoo directly.\n');
    }
    console.log();

    // ── Section 1: Auth guard ───────────────────────────────────────────────
    console.log('[ 1 ] Auth Guard — protected routes reject unauthenticated requests');
    const protectedRoutes = [
        '/time-off?employee_id=1',
        '/expenses?employee_id=1',
        '/helpdesk?employee_id=1',
        '/timesheet?employee_id=1',
        '/maintenance?employee_id=1',
        '/notifications?employee_id=1',
    ];
    for (const route of protectedRoutes) {
        const { status } = await get(route);
        if (status === 401) {
            pass(`GET ${route} → 401`);
        } else {
            fail(`GET ${route} → expected 401`, `got ${status}`);
        }
    }
    console.log();

    // ── Section 2: Login ────────────────────────────────────────────────────
    console.log('[ 2 ] Login');

    // 2a: Missing fields
    const { status: s400 } = await post('/auth/login', {});
    s400 === 400 ? pass('POST /auth/login with empty body → 400') : fail('POST /auth/login empty body', `got ${s400}`);

    // 2b: Wrong credentials
    const { status: s401 } = await post('/auth/login', { employee_id: '000000', pin: '0000' });
    s401 === 401 ? pass('POST /auth/login wrong creds → 401') : fail('POST /auth/login wrong creds', `got ${s401}`);

    // 2c: Valid login (only if we have a test employee)
    let token = null;
    let employeeId = null;
    if (testEmployee) {
        const { status, body } = await post('/auth/login', {
            employee_id: testEmployee.barcode,
            pin: testEmployee.pin,
        });
        if (status === 200 && body.token) {
            pass(`POST /auth/login valid → 200 (employee: ${body.user?.name})`);
            token = body.token;
            employeeId = body.user?.id || testEmployee.id;
            console.log(`  → JWT obtained, employee id=${employeeId}`);
        } else {
            fail('POST /auth/login valid credentials', `status=${status} body=${JSON.stringify(body)}`);
        }
    } else {
        console.log('  ⏭️  Skipping valid login test (no employee with barcode+pin found)');
    }
    console.log();

    if (!token || !employeeId) {
        console.log('  ⚠️  Skipping authenticated tests — no valid JWT.\n');
        printSummary();
        return;
    }

    // ── Section 3: Time Off ─────────────────────────────────────────────────
    console.log('[ 3 ] Time Off');

    const { status: toStatus, body: toBody } = await get(`/time-off?employee_id=${employeeId}`, token);
    if (toStatus === 200 && Array.isArray(toBody.leaves)) {
        pass(`GET /time-off → 200 (${toBody.leaves.length} leaves)`);
    } else {
        fail('GET /time-off', `status=${toStatus} body=${JSON.stringify(toBody)}`);
    }

    const { status: ttStatus, body: ttBody } = await get('/time-off/types', token);
    if (ttStatus === 200 && Array.isArray(ttBody.types)) {
        pass(`GET /time-off/types → 200 (${ttBody.types.length} types)`);
        if (ttBody.types.length > 0) {
            console.log(`  → Sample types: ${ttBody.types.slice(0, 3).map(t => t.name).join(', ')}`);
        }
    } else {
        fail('GET /time-off/types', `status=${ttStatus} body=${JSON.stringify(ttBody)}`);
    }
    console.log();

    // ── Section 4: Expenses ─────────────────────────────────────────────────
    console.log('[ 4 ] Expenses');

    const { status: expStatus, body: expBody } = await get(`/expenses?employee_id=${employeeId}`, token);
    if (expStatus === 200 && Array.isArray(expBody.expenses)) {
        pass(`GET /expenses → 200 (${expBody.expenses.length} expenses)`);
    } else {
        fail('GET /expenses', `status=${expStatus} body=${JSON.stringify(expBody)}`);
    }

    const { status: pendStatus, body: pendBody } = await get(`/expenses/pending?employee_id=${employeeId}`, token);
    // Backend returns { expenses } key
    if (pendStatus === 200 && Array.isArray(pendBody.expenses)) {
        pass(`GET /expenses/pending → 200 (${pendBody.expenses.length} pending)`);
    } else {
        fail('GET /expenses/pending', `status=${pendStatus} body=${JSON.stringify(pendBody).substring(0, 200)}`);
    }

    const { status: prodStatus, body: prodBody } = await get('/expenses/products', token);
    if (prodStatus === 200 && Array.isArray(prodBody.products)) {
        pass(`GET /expenses/products → 200 (${prodBody.products.length} products)`);
    } else {
        fail('GET /expenses/products', `status=${prodStatus} body=${JSON.stringify(prodBody)}`);
    }
    console.log();

    // ── Section 5: Helpdesk ─────────────────────────────────────────────────
    console.log('[ 5 ] Helpdesk');

    const { status: hdStatus, body: hdBody } = await get(`/helpdesk?employee_id=${employeeId}`, token);
    if (hdStatus === 200 && Array.isArray(hdBody.tickets)) {
        pass(`GET /helpdesk → 200 (${hdBody.tickets.length} tickets)`);
    } else {
        fail('GET /helpdesk', `status=${hdStatus} body=${JSON.stringify(hdBody)}`);
    }

    const { status: hdCatStatus, body: hdCatBody } = await get('/helpdesk/teams', token);
    if (hdCatStatus === 200 && Array.isArray(hdCatBody.teams)) {
        pass(`GET /helpdesk/teams → 200 (${hdCatBody.teams.length} teams)`);
    } else {
        fail('GET /helpdesk/teams', `status=${hdCatStatus} body=${JSON.stringify(hdCatBody)}`);
    }
    console.log();

    // ── Section 6: Timesheet ────────────────────────────────────────────────
    console.log('[ 6 ] Timesheet');

    const { status: tsStatus, body: tsBody } = await get(`/timesheet?employee_id=${employeeId}`, token);
    if (tsStatus === 200 && Array.isArray(tsBody.entries)) {
        pass(`GET /timesheet → 200 (${tsBody.entries.length} entries)`);
    } else {
        fail('GET /timesheet', `status=${tsStatus} body=${JSON.stringify(tsBody)}`);
    }

    const { status: projStatus, body: projBody } = await get('/timesheet/projects', token);
    if (projStatus === 200 && Array.isArray(projBody.projects)) {
        pass(`GET /timesheet/projects → 200 (${projBody.projects.length} projects)`);
    } else {
        fail('GET /timesheet/projects', `status=${projStatus} body=${JSON.stringify(projBody)}`);
    }
    console.log();

    // ── Section 7: Maintenance ──────────────────────────────────────────────
    console.log('[ 7 ] Maintenance');

    const { status: mStatus, body: mBody } = await get(`/maintenance?employee_id=${employeeId}`, token);
    if (mStatus === 200 && Array.isArray(mBody.requests)) {
        pass(`GET /maintenance → 200 (${mBody.requests.length} requests)`);
    } else {
        fail('GET /maintenance', `status=${mStatus} body=${JSON.stringify(mBody)}`);
    }

    const { status: mCatStatus, body: mCatBody } = await get('/maintenance/categories', token);
    if (mCatStatus === 200 && Array.isArray(mCatBody.categories)) {
        pass(`GET /maintenance/categories → 200 (${mCatBody.categories.length} categories)`);
    } else {
        fail('GET /maintenance/categories', `status=${mCatStatus} body=${JSON.stringify(mCatBody)}`);
    }
    console.log();

    // ── Section 8: Notifications ────────────────────────────────────────────
    console.log('[ 8 ] Notifications');

    const { status: notifStatus, body: notifBody } = await get(`/notifications?employee_id=${employeeId}`, token);
    if (notifStatus === 200 && Array.isArray(notifBody.notifications)) {
        pass(`GET /notifications → 200 (${notifBody.notifications.length} notifications)`);
    } else {
        fail('GET /notifications', `status=${notifStatus} body=${JSON.stringify(notifBody)}`);
    }
    console.log();

    printSummary();
}

function printSummary() {
    console.log('════════════════════════════════════════════════════');
    console.log(`  Results: ${passCount} passed, ${failCount} failed`);
    console.log('════════════════════════════════════════════════════');
    if (failures.length > 0) {
        console.log('\n  Failed tests:');
        failures.forEach(f => console.log(`    ❌ ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
    }
    console.log();
}

runTests().catch(e => {
    console.error('\nUnhandled error in test runner:', e);
    process.exit(1);
});
