/**
 * Exhaustive Shadow Portal mobile smoke runner.
 *
 * Default targets, in order:
 *   1. http://localhost:3000
 *   2. https://erp-external-app.vercel.app
 *
 * Usage:
 *   SMOKE_WRITE=true npm.cmd run smoke
 *   SMOKE_BASE_URL=https://erp-external-app.vercel.app SMOKE_WRITE=true npm.cmd run smoke
 *   SMOKE_BASE_URLS=http://localhost:3000,https://erp-external-app.vercel.app SMOKE_WRITE=true npm.cmd run smoke
 */

import fs from 'fs';
import path from 'path';

type ResultStatus = 'PASS' | 'FAIL' | 'SKIPPED_PRECONDITION' | 'MODULE_UNAVAILABLE';

interface Credential {
    company: string;
    spNumber: string;
    employeeName: string;
    barcode: string;
    pin: string;
}

interface ApiResult {
    status: number;
    ok: boolean;
    body: any;
}

interface SmokeResult {
    target: string;
    company: string;
    spNumber: string;
    employeeName: string;
    employeeRef: string;
    loginEmployeeId?: number;
    action: string;
    method: string;
    endpoint: string;
    statusCode?: number;
    result: ResultStatus;
    request?: any;
    response?: any;
    note?: string;
    likelyCause?: string;
}

const PRODUCTION_URL = 'https://erp-external-app.vercel.app';
const WRITE_ENABLED = String(process.env.SMOKE_WRITE ?? '').toLowerCase() === 'true';
const ADMIN_SECRET = process.env.SMOKE_ADMIN_SECRET ?? '';
const REPORT_DIR = process.env.SMOKE_REPORT_DIR ?? path.resolve(__dirname, '../../../smoke-reports');
const RUN_ID = makeRunId();

const TARGETS = (process.env.SMOKE_BASE_URLS
    ? process.env.SMOKE_BASE_URLS.split(',')
    : process.env.SMOKE_BASE_URL
        ? [process.env.SMOKE_BASE_URL]
        : ['http://localhost:3000', PRODUCTION_URL])
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const CREDENTIALS = loadCredentials();
const CREDENTIAL_BARCODES = new Set(CREDENTIALS.map(credential => credential.barcode));

const TINY_PNG_ATTACHMENT = {
    name: 'smoke.png',
    mimetype: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
};

const allResults: SmokeResult[] = [];

function makeRunId() {
    const d = new Date();
    const stamp = [
        d.getUTCFullYear(),
        String(d.getUTCMonth() + 1).padStart(2, '0'),
        String(d.getUTCDate()).padStart(2, '0'),
        '-',
        String(d.getUTCHours()).padStart(2, '0'),
        String(d.getUTCMinutes()).padStart(2, '0'),
        String(d.getUTCSeconds()).padStart(2, '0'),
    ].join('');
    return `SMOKE-${stamp}`;
}

function loadCredentials(): Credential[] {
    const fixturePath = process.env.SMOKE_CREDENTIALS_FILE
        ? path.resolve(process.env.SMOKE_CREDENTIALS_FILE)
        : path.resolve(__dirname, 'credentials.local.json');
    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Smoke credentials fixture not found: ${fixturePath}. Copy credentials.example.json to credentials.local.json and fill it locally.`);
    }
    const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    if (!Array.isArray(parsed)) {
        throw new Error('Smoke credentials fixture must be an array.');
    }
    return parsed.map((entry, index) => {
        for (const key of ['company', 'spNumber', 'employeeName', 'barcode', 'pin']) {
            if (typeof entry?.[key] !== 'string' || !entry[key].trim()) {
                throw new Error(`Smoke credential #${index + 1} is missing string field "${key}".`);
            }
        }
        return entry as Credential;
    });
}

function safeName(value: string) {
    return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function labelFor(credential: Credential, loginEmployeeId?: number) {
    return `${RUN_ID}-${safeName(credential.company)}-${loginEmployeeId ?? credential.barcode}`;
}

function nextWeekdayIso(offsetDays = 14, hour = 9, minute = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
}

function stablePastIso(index: number, hour = 7) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    d.setUTCHours(hour, index % 50, 0, 0);
    return d.toISOString();
}

function dateOnly(iso: string) {
    return iso.split('T')[0];
}

function sanitize(value: any): any {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(sanitize);
    if (typeof value !== 'object') return value;
    const out: Record<string, any> = {};
    for (const [key, raw] of Object.entries(value)) {
        const lower = key.toLowerCase();
        if (['pin', 'password', 'authorization', 'token', 'barcode'].some(secret => lower.includes(secret))) {
            out[key] = '[REDACTED]';
        } else if (typeof raw === 'string' && CREDENTIAL_BARCODES.has(raw)) {
            out[key] = '[REDACTED_CREDENTIAL]';
        } else if (lower === 'data' && typeof raw === 'string' && raw.length > 40) {
            out[key] = `[base64:${raw.length} chars]`;
        } else {
            out[key] = sanitize(raw);
        }
    }
    return out;
}

function classifyFailure(action: string, response: any, statusCode?: number): string {
    const raw = JSON.stringify(response ?? {}).toLowerCase();
    if (raw.includes('invalid structure') || raw.includes('validation failed') || raw.includes('invalid input')) return 'invalid payload structure';
    if (raw.includes('product') || raw.includes('category') || raw.includes('journal') || raw.includes('account')) return 'missing or incompatible Odoo product/account config';
    if (raw.includes('compan')) return 'employee/company mismatch';
    if (raw.includes('invalid field') || raw.includes('price_unit') || raw.includes('total_amount')) return 'Odoo version field mismatch';
    if (raw.includes('balance') || raw.includes('allocation') || raw.includes('overlap') || raw.includes('already')) return 'expected Odoo business validation';
    if (statusCode && statusCode >= 500) return 'backend/platform/Odoo RPC failure';
    if (action.toLowerCase().includes('expense')) return 'expense submission failure';
    return 'unclassified failure';
}

async function api(
    target: string,
    token: string,
    method: string,
    endpoint: string,
    body?: any,
    extraHeaders?: Record<string, string>
): Promise<ApiResult> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const response = await fetch(`${target}${endpoint}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
        status: response.status,
        ok: response.ok,
        body: await response.json().catch(() => ({})),
    };
}

function record(
    target: string,
    credential: Credential,
    action: string,
    method: string,
    endpoint: string,
    apiResult: ApiResult | null,
    result: ResultStatus,
    request?: any,
    note?: string,
    loginEmployeeId?: number
) {
    const entry: SmokeResult = {
        target,
        company: credential.company,
        spNumber: credential.spNumber,
        employeeName: credential.employeeName,
        employeeRef: credentialRef(credential),
        loginEmployeeId,
        action,
        method,
        endpoint,
        statusCode: apiResult?.status,
        result,
        request: sanitize(request),
        response: sanitize(apiResult?.body),
        note,
        likelyCause: result === 'FAIL' ? classifyFailure(action, apiResult?.body, apiResult?.status) : undefined,
    };
    allResults.push(entry);

    const icon = result === 'PASS' ? 'OK' : result === 'FAIL' ? 'FAIL' : result === 'MODULE_UNAVAILABLE' ? 'N/A' : 'SKIP';
    console.log(`  ${icon.padEnd(4)} ${credential.spNumber} ${credentialRef(credential)} :: ${action}${apiResult ? ` (${apiResult.status})` : ''}${note ? ` - ${note}` : ''}`);
}

function passStatus(status: number) {
    return status >= 200 && status < 300;
}

function moduleUnavailable(body: any) {
    return body?.available === false;
}

function firstRequestable(items: any[] | undefined): any | null {
    return Array.isArray(items) ? (items.find(item => item?.requestable !== false) ?? null) : null;
}

function maskIdentifier(identifier: string) {
    return `***${identifier.slice(-3)}`;
}

function credentialRef(credential: Credential) {
    return `${credential.employeeName} (${maskIdentifier(credential.barcode)})`;
}

async function checkedApi(
    target: string,
    credential: Credential,
    token: string,
    action: string,
    method: string,
    endpoint: string,
    requestBody?: any,
    loginEmployeeId?: number,
    options: { allowModuleUnavailable?: boolean; expectArrayAt?: string } = {}
) {
    const result = await api(target, token, method, endpoint, requestBody);
    if (options.allowModuleUnavailable && moduleUnavailable(result.body)) {
        record(target, credential, action, method, endpoint, result, 'MODULE_UNAVAILABLE', requestBody, result.body?.message, loginEmployeeId);
        return result;
    }
    if (!passStatus(result.status)) {
        record(target, credential, action, method, endpoint, result, 'FAIL', requestBody, undefined, loginEmployeeId);
        return result;
    }
    if (options.expectArrayAt && !Array.isArray(result.body?.[options.expectArrayAt])) {
        record(target, credential, action, method, endpoint, result, 'FAIL', requestBody, `Expected ${options.expectArrayAt} array`, loginEmployeeId);
        return result;
    }
    record(target, credential, action, method, endpoint, result, 'PASS', requestBody, undefined, loginEmployeeId);
    return result;
}

async function targetReachable(target: string): Promise<{ ok: boolean; note?: string }> {
    try {
        const response = await fetch(`${target}/health`);
        return { ok: response.ok, note: response.ok ? undefined : `/health returned ${response.status}` };
    } catch (error: any) {
        const cause = error?.cause?.code ? ` (${error.cause.code})` : '';
        return { ok: false, note: `${error?.message ?? 'fetch failed'}${cause}` };
    }
}

async function runEmployee(target: string, credential: Credential, index: number) {
    let token = '';
    let employeeId = 0;
    const runLabelBase = labelFor(credential);

    const tenantLookup = await checkedApi(target, credential, '', 'tenant lookup', 'GET', `/auth/tenant/${credential.spNumber}`, undefined, undefined);
    if (!passStatus(tenantLookup.status)) return;

    const loginBody = { employee_id: credential.barcode, pin: credential.pin, tenant_subscription_number: credential.spNumber };
    const login = await api(target, '', 'POST', '/auth/login', loginBody);
    if (passStatus(login.status) && login.body?.token && typeof login.body?.user?.id === 'number') {
        token = login.body.token;
        employeeId = login.body.user.id;
        record(target, credential, 'legacy login', 'POST', '/auth/login', login, 'PASS', loginBody, undefined, employeeId);
    } else {
        record(target, credential, 'legacy login', 'POST', '/auth/login', login, 'FAIL', loginBody);
        return;
    }

    const runLabel = labelFor(credential, employeeId);

    await checkedApi(target, credential, token, 'protected route with JWT', 'GET', `/time-off?employee_id=${employeeId}`, undefined, employeeId);
    await checkedApi(target, credential, token, 'spoofed employee_id must use JWT employee', 'GET', '/expenses?employee_id=999999', undefined, employeeId, { expectArrayAt: 'expenses' });

    const timeOff = await checkedApi(target, credential, token, 'dashboard time off list', 'GET', `/time-off?employee_id=${employeeId}`, undefined, employeeId, { expectArrayAt: 'leaves' });
    const expenses = await checkedApi(target, credential, token, 'dashboard expenses list', 'GET', `/expenses?employee_id=${employeeId}`, undefined, employeeId, { expectArrayAt: 'expenses' });
    await checkedApi(target, credential, token, 'dashboard timesheet list', 'GET', `/timesheet?employee_id=${employeeId}`, undefined, employeeId, { expectArrayAt: 'entries' });
    await checkedApi(target, credential, token, 'dashboard helpdesk list', 'GET', `/helpdesk?employee_id=${employeeId}`, undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'tickets' });
    await checkedApi(target, credential, token, 'dashboard maintenance list', 'GET', `/maintenance?employee_id=${employeeId}`, undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'requests' });

    const leaveTypes = await checkedApi(target, credential, token, 'lookup leave types', 'GET', '/time-off/types', undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'types' });
    const products = await checkedApi(target, credential, token, 'lookup expense products', 'GET', '/expenses/products', undefined, employeeId, { expectArrayAt: 'products' });
    await checkedApi(target, credential, token, 'lookup expense taxes', 'GET', '/expenses/taxes', undefined, employeeId);
    const projects = await checkedApi(target, credential, token, 'lookup timesheet projects', 'GET', '/timesheet/projects', undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'projects' });
    await checkedApi(target, credential, token, 'lookup helpdesk teams', 'GET', '/helpdesk/teams', undefined, employeeId, { allowModuleUnavailable: true });
    await checkedApi(target, credential, token, 'lookup helpdesk ticket types', 'GET', '/helpdesk/ticket-types', undefined, employeeId, { allowModuleUnavailable: true });
    await checkedApi(target, credential, token, 'lookup helpdesk tags', 'GET', '/helpdesk/tags', undefined, employeeId, { allowModuleUnavailable: true });
    await checkedApi(target, credential, token, 'lookup helpdesk agents', 'GET', '/helpdesk/agents', undefined, employeeId, { allowModuleUnavailable: true });
    await checkedApi(target, credential, token, 'lookup maintenance categories', 'GET', '/maintenance/categories', undefined, employeeId, { allowModuleUnavailable: true });
    await checkedApi(target, credential, token, 'lookup maintenance equipment', 'GET', '/maintenance/equipment', undefined, employeeId, { allowModuleUnavailable: true });
    const maintenanceTeams = await checkedApi(target, credential, token, 'lookup maintenance teams', 'GET', '/maintenance/teams', undefined, employeeId, { allowModuleUnavailable: true });
    const attendance = await checkedApi(target, credential, token, 'attendance history', 'GET', `/attendance?employee_id=${employeeId}`, undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'records' });
    const overtime = await checkedApi(target, credential, token, 'attendance overtime history', 'GET', `/attendance/overtime?employee_id=${employeeId}`, undefined, employeeId, { allowModuleUnavailable: true });

    const notifications = await checkedApi(target, credential, token, 'notifications list', 'GET', `/notifications?employee_id=${employeeId}`, undefined, employeeId, { expectArrayAt: 'notifications' });
    if (Array.isArray(notifications.body?.notifications) && notifications.body.notifications[0]?.id) {
        await checkedApi(target, credential, token, 'mark first notification read', 'PUT', `/notifications/${notifications.body.notifications[0].id}/read`, undefined, employeeId);
    } else {
        record(target, credential, 'mark first notification read', 'PUT', '/notifications/:id/read', null, 'SKIPPED_PRECONDITION', undefined, 'No notification available', employeeId);
    }
    await checkedApi(target, credential, token, 'mark all notifications read', 'PUT', '/notifications/read-all', undefined, employeeId);

    await checkedApi(target, credential, token, 'push token create', 'POST', '/auth/push-token', {
        employee_id: employeeId,
        token: `ExponentPushToken[${runLabelBase}]`,
        tenant_code: credential.spNumber,
    }, employeeId);
    await checkedApi(target, credential, token, 'push token delete', 'DELETE', '/auth/push-token', {
        employee_id: employeeId,
        tenant_code: credential.spNumber,
    }, employeeId);

    if (!WRITE_ENABLED) {
        record(target, credential, 'write flows', 'POST', '*', null, 'SKIPPED_PRECONDITION', undefined, 'SMOKE_WRITE=true not set', employeeId);
        return;
    }

    const product = firstRequestable(products.body?.products);
    if (product?.id) {
        await checkedApi(target, credential, token, 'create expense', 'POST', '/expenses', {
            employee_id: employeeId,
            product_id: product.id,
            name: `${runLabel} expense`,
            unit_amount: 1,
            quantity: 1,
            date: dateOnly(new Date().toISOString()),
            payment_mode: 'own_account',
            attachments: [TINY_PNG_ATTACHMENT],
        }, employeeId);
    } else {
        record(target, credential, 'create expense', 'POST', '/expenses', null, 'SKIPPED_PRECONDITION', undefined, 'No expense product available', employeeId);
    }

    const leaveType = firstRequestable(leaveTypes.body?.types);
    if (leaveType?.id) {
        const from = nextWeekdayIso(14 + (index % 5), 9, 0);
        const to = nextWeekdayIso(14 + (index % 5), 17, 0);
        await checkedApi(target, credential, token, 'create time off', 'POST', '/time-off', {
            employee_id: employeeId,
            leave_type_id: leaveType.id,
            date_from: from,
            date_to: to,
            name: `${runLabel} time off`,
            attachments: [TINY_PNG_ATTACHMENT],
        }, employeeId);
    } else {
        record(target, credential, 'create time off', 'POST', '/time-off', null, 'SKIPPED_PRECONDITION', undefined, 'No leave type available', employeeId);
    }

    const project = Array.isArray(projects.body?.projects) ? projects.body.projects[0] : null;
    if (project?.id) {
        const tasks = await checkedApi(target, credential, token, 'lookup timesheet tasks', 'GET', `/timesheet/tasks?project_id=${project.id}`, undefined, employeeId, { allowModuleUnavailable: true, expectArrayAt: 'tasks' });
        const task = firstRequestable(tasks.body?.tasks);
        await checkedApi(target, credential, token, 'create timesheet', 'POST', '/timesheet', {
            employee_id: employeeId,
            project_id: project.id,
            task_id: task?.id,
            date: dateOnly(new Date().toISOString()),
            unit_amount: 0.25,
            name: `${runLabel} timesheet`,
        }, employeeId);
    } else {
        record(target, credential, 'create timesheet', 'POST', '/timesheet', null, 'SKIPPED_PRECONDITION', undefined, 'No project available', employeeId);
    }

    const helpdeskAvailable = !moduleUnavailable(await api(target, token, 'GET', '/helpdesk/teams'));
    if (helpdeskAvailable) {
        await checkedApi(target, credential, token, 'create helpdesk ticket', 'POST', '/helpdesk', {
            employee_id: employeeId,
            name: `${runLabel} helpdesk`,
            description: `${runLabel} automated smoke ticket`,
            priority: '0',
            attachments: [TINY_PNG_ATTACHMENT],
        }, employeeId, { allowModuleUnavailable: true });
    } else {
        record(target, credential, 'create helpdesk ticket', 'POST', '/helpdesk', null, 'MODULE_UNAVAILABLE', undefined, 'Helpdesk module unavailable', employeeId);
    }

    const maintenanceAvailable = !moduleUnavailable(await api(target, token, 'GET', '/maintenance/categories'));
    if (maintenanceAvailable) {
        const maintenanceTeam = firstRequestable(maintenanceTeams.body?.teams);
        await checkedApi(target, credential, token, 'create maintenance request', 'POST', '/maintenance', {
            employee_id: employeeId,
            name: `${runLabel} maintenance`,
            description: `${runLabel} automated smoke maintenance request`,
            maintenance_type: 'corrective',
            maintenance_team_id: maintenanceTeam?.id,
            attachments: [TINY_PNG_ATTACHMENT],
        }, employeeId, { allowModuleUnavailable: true });
    } else {
        record(target, credential, 'create maintenance request', 'POST', '/maintenance', null, 'MODULE_UNAVAILABLE', undefined, 'Maintenance module unavailable', employeeId);
    }

    if (!moduleUnavailable(attendance.body)) {
        const checkIn = stablePastIso(index, 6);
        const checkOut = new Date(new Date(checkIn).getTime() + 15 * 60 * 1000).toISOString();
        await checkedApi(target, credential, token, 'create attendance correction', 'POST', '/attendance/correction', {
            employee_id: employeeId,
            check_in: checkIn,
            check_out: checkOut,
            reason: `${runLabel} attendance correction`,
        }, employeeId, { allowModuleUnavailable: true });
    }

    if (!moduleUnavailable(overtime.body) && overtime.body?.available !== false) {
        await checkedApi(target, credential, token, 'create overtime', 'POST', '/attendance/overtime', {
            employee_id: employeeId,
            date: dateOnly(nextWeekdayIso(35 + index, 6, 0)),
            duration: 0.25,
            reason: `${runLabel} overtime`,
        }, employeeId, { allowModuleUnavailable: true });
    }

    if (leaveType?.id) {
        const from = nextWeekdayIso(21 + (index % 5), 9, 0);
        const to = nextWeekdayIso(21 + (index % 5), 17, 0);
        await checkedApi(target, credential, token, 'create attendance justification', 'POST', '/attendance/justification', {
            employee_id: employeeId,
            leave_type_id: leaveType.id,
            date_from: from,
            date_to: to,
            justification: `${runLabel} absence justification`,
        }, employeeId, { allowModuleUnavailable: true });
    } else {
        record(target, credential, 'create attendance justification', 'POST', '/attendance/justification', null, 'SKIPPED_PRECONDITION', undefined, 'No leave type available', employeeId);
    }

    void timeOff;
    void expenses;
}

async function runTarget(target: string) {
    console.log(`\n=== Target: ${target} ===`);
    const reachable = await targetReachable(target);
    if (!reachable.ok) {
        const dummy = CREDENTIALS[0];
        record(target, dummy, 'target reachability', 'GET', '/health', null, 'SKIPPED_PRECONDITION', undefined, `Target not reachable: ${reachable.note ?? 'unknown error'}`);
        return;
    }

    for (let i = 0; i < CREDENTIALS.length; i++) {
        const credential = CREDENTIALS[i];
        console.log(`\n-- ${credential.spNumber} ${credential.company} :: ${credential.employeeName} --`);
        try {
            await runEmployee(target, credential, i);
        } catch (error: any) {
            record(target, credential, 'unhandled employee flow error', '*', '*', null, 'FAIL', undefined, error?.message ?? String(error));
        }
    }

    if (ADMIN_SECRET) {
        const adminCheck = await api(target, '', 'GET', '/admin/tenants', undefined, { 'x-admin-secret': ADMIN_SECRET });
        const dummy = CREDENTIALS[0];
        record(target, dummy, 'admin tenants list', 'GET', '/admin/tenants', adminCheck, passStatus(adminCheck.status) ? 'PASS' : 'FAIL', undefined);
    }
}

function summarize() {
    const counts = allResults.reduce<Record<ResultStatus, number>>((acc, row) => {
        acc[row.result] = (acc[row.result] ?? 0) + 1;
        return acc;
    }, { PASS: 0, FAIL: 0, SKIPPED_PRECONDITION: 0, MODULE_UNAVAILABLE: 0 });
    return counts;
}

function writeReports() {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const jsonPath = path.join(REPORT_DIR, `${RUN_ID}.json`);
    const mdPath = path.join(REPORT_DIR, `${RUN_ID}.md`);
    fs.writeFileSync(jsonPath, JSON.stringify({ runId: RUN_ID, writeEnabled: WRITE_ENABLED, targets: TARGETS, results: allResults }, null, 2));

    const counts = summarize();
    const lines: string[] = [
        `# ${RUN_ID} Smoke Report`,
        '',
        `Write enabled: ${WRITE_ENABLED}`,
        `Targets: ${TARGETS.join(', ')}`,
        '',
        `Summary: PASS ${counts.PASS}, FAIL ${counts.FAIL}, SKIPPED ${counts.SKIPPED_PRECONDITION}, MODULE_UNAVAILABLE ${counts.MODULE_UNAVAILABLE}`,
        '',
        '## Failures',
        '',
    ];
    const failures = allResults.filter(r => r.result === 'FAIL');
    if (failures.length === 0) {
        lines.push('No failures.');
    } else {
        lines.push('| Target | Tenant | Employee | Action | Status | Likely Cause | Error |');
        lines.push('|---|---|---|---|---:|---|---|');
        for (const f of failures) {
            const error = String(f.response?.error ?? f.note ?? JSON.stringify(f.response ?? {})).replace(/\|/g, '/').slice(0, 300);
            lines.push(`| ${f.target} | ${f.spNumber} | ${f.employeeRef} | ${f.action} | ${f.statusCode ?? ''} | ${f.likelyCause ?? ''} | ${error} |`);
        }
    }

    lines.push('', '## All Results', '');
    lines.push('| Target | Tenant | Employee | Action | Result | Status | Note |');
    lines.push('|---|---|---|---|---|---:|---|');
    for (const r of allResults) {
        lines.push(`| ${r.target} | ${r.spNumber} | ${r.employeeRef} | ${r.action} | ${r.result} | ${r.statusCode ?? ''} | ${(r.note ?? '').replace(/\|/g, '/')} |`);
    }

    fs.writeFileSync(mdPath, lines.join('\n'));
    return { jsonPath, mdPath };
}

async function main() {
    console.log(`Run ID: ${RUN_ID}`);
    console.log(`Write enabled: ${WRITE_ENABLED}`);
    console.log(`Targets: ${TARGETS.join(', ')}`);

    for (const target of TARGETS) {
        await runTarget(target);
    }

    const paths = writeReports();
    const counts = summarize();
    console.log('\n=== Summary ===');
    console.log(`PASS ${counts.PASS} | FAIL ${counts.FAIL} | SKIPPED ${counts.SKIPPED_PRECONDITION} | MODULE_UNAVAILABLE ${counts.MODULE_UNAVAILABLE}`);
    console.log(`JSON: ${paths.jsonPath}`);
    console.log(`Markdown: ${paths.mdPath}`);

    process.exit(counts.FAIL > 0 ? 1 : 0);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
