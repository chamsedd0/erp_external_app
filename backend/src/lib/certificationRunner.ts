import { randomUUID } from 'crypto';
import type { TenantConfig } from './tenantStore';
import { getOdooClient, OdooClientInstance } from '../odoo/client';
import { attachmentsSchema } from './attachments';
import { assertEmployeeCanUseCompany, companyContext, relationId } from './odooCompatibility';
import { getCustomFieldReport } from './schemaCache';
import { portalAuthStore } from './portalAuthStore';
import type {
    CertificationEmployeeInput,
    CertificationError,
    CertificationMode,
    CertificationRun,
    CertificationScenarioResult,
    CertificationStatus,
    ScenarioStatus,
} from './certificationStore';

interface CertificationOptions {
    include_attachments?: boolean;
    include_wrong_company_tests?: boolean;
    include_optional_modules?: boolean;
}

export interface RunCertificationInput {
    mode: CertificationMode;
    employees: CertificationEmployeeInput[];
    options?: CertificationOptions;
}

interface ResolvedEmployee {
    input: CertificationEmployeeInput;
    label: string;
    employee_id?: number;
    name?: string;
    work_email?: string;
    company_id?: number | null;
    login_ok: boolean;
}

type ScenarioBody = () => Promise<{
    status?: ScenarioStatus;
    message?: string;
    details?: Record<string, any>;
    employee_id?: number;
    request_type?: string;
} | void>;

const REQUIRED_MODELS = new Set(['hr.expense', 'hr.leave']);
const SCHEMA_MODELS = [
    'hr.expense',
    'hr.leave',
    'helpdesk.ticket',
    'maintenance.request',
    'account.analytic.line',
    'hr.attendance',
    'hr.attendance.overtime',
];

const REQUIRED_PICKERS: Array<{ id: string; label: string; model: string; domain: any[]; fields: string[]; requestType: string }> = [
    { id: 'expense_products', label: 'Expense products load', model: 'product.product', domain: [['can_be_expensed', '=', true]], fields: ['id', 'name', 'company_id'], requestType: 'expense' },
    { id: 'leave_types', label: 'Leave types load', model: 'hr.leave.type', domain: [], fields: ['id', 'name'], requestType: 'time_off' },
];

const OPTIONAL_PICKERS: Array<{ id: string; label: string; model: string; domain: any[]; fields: string[]; requestType: string }> = [
    { id: 'timesheet_projects', label: 'Timesheet projects load', model: 'project.project', domain: [], fields: ['id', 'name', 'company_id'], requestType: 'timesheet' },
    { id: 'maintenance_teams', label: 'Maintenance teams load', model: 'maintenance.team', domain: [], fields: ['id', 'name', 'company_id'], requestType: 'maintenance' },
    { id: 'helpdesk_teams', label: 'Helpdesk teams load', model: 'helpdesk.team', domain: [], fields: ['id', 'name', 'company_id'], requestType: 'helpdesk' },
];

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const TINY_PDF = 'JVBERi0xLjQKJcfsj6IKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9Db3VudCAwID4+CmVuZG9iagp0cmFpbGVyCjw8IC9Sb290IDEgMCBSID4+CiUlRU9G';

function certContext(companyId?: number | null): Record<string, any> {
    return { ...companyContext(companyId ?? null), lang: 'en_US' };
}

function statusFromScenarios(scenarios: CertificationScenarioResult[]): CertificationStatus {
    const blocking = scenarios.some(s => s.status === 'fail' && s.severity === 'blocking');
    if (blocking) return 'fail';
    const warnings = scenarios.some(s => s.status === 'warn' || s.status === 'fail');
    return warnings ? 'warn' : 'pass';
}

function summarize(scenarios: CertificationScenarioResult[]) {
    return {
        passed: scenarios.filter(s => s.status === 'pass').length,
        warnings: scenarios.filter(s => s.status === 'warn').length,
        failed: scenarios.filter(s => s.status === 'fail').length,
        skipped: scenarios.filter(s => s.status === 'skipped').length,
        blocking_failures: scenarios.filter(s => s.status === 'fail' && s.severity === 'blocking').length,
    };
}

function isSecretKey(key: string): boolean {
    return /(pin|password|token|authorization|auth|barcode|identifier|credential|datas|data|base64|secret)/i.test(key);
}

export function sanitizeForCertification(value: any): any {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map(v => sanitizeForCertification(v));
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, val]) => [
            key,
            isSecretKey(key) ? '[REDACTED]' : sanitizeForCertification(val),
        ]));
    }
    if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 200)}...[TRUNCATED]`;
    return value;
}

function errorMessage(error: any): string {
    return String(error?.faultString ?? error?.message ?? error ?? 'Unknown error');
}

function scenarioError(id: string, error: any): CertificationError {
    return {
        scenario_id: id,
        message: errorMessage(error),
        details: sanitizeForCertification(error),
    };
}

function normalizeEmployees(inputs: CertificationEmployeeInput[]): CertificationEmployeeInput[] {
    return inputs.slice(0, 3).map((employee, index) => ({
        ...employee,
        label: employee.label?.trim() || `Employee ${index + 1}`,
        identifier: employee.identifier.trim(),
        work_email: employee.work_email?.trim().toLowerCase(),
    }));
}

async function readFirst(client: OdooClientInstance, uid: number, model: string, domain: any[], fields: string[], context?: Record<string, any>) {
    const records: any = await client.searchRead(uid, model, domain, fields, { silent: true, context, limit: 1 });
    return Array.isArray(records) ? records[0] : undefined;
}

async function resolveEmployee(
    tenantId: string,
    client: OdooClientInstance,
    uid: number,
    input: CertificationEmployeeInput,
    index: number,
): Promise<ResolvedEmployee> {
    const label = input.label?.trim() || `Employee ${index + 1}`;

    if (input.login_method === 'activation_invite') {
        const employeeIdFromIdentifier = Number.parseInt(input.identifier, 10);
        let credential = Number.isInteger(employeeIdFromIdentifier)
            ? await portalAuthStore.getCredential(tenantId, employeeIdFromIdentifier)
            : null;
        if (!credential && input.work_email) {
            credential = await portalAuthStore.getCredentialByEmail(tenantId, input.work_email);
        }
        const loginOk = await portalAuthStore.verifyCredential(credential, input.pin ?? '');
        if (!credential || !loginOk) return { input, label, login_ok: false };
        const employee = await readFirst(
            client,
            uid,
            'hr.employee',
            [['id', '=', credential.employeeId]],
            ['id', 'name', 'company_id', 'work_email'],
        );
        return {
            input,
            label,
            employee_id: credential.employeeId,
            name: employee?.name ?? credential.name,
            work_email: employee?.work_email ?? credential.workEmail,
            company_id: relationId(employee?.company_id),
            login_ok: true,
        };
    }

    let employee: any;
    if (input.login_method === 'barcode_pin') {
        const result: any = await client.searchEmployee(uid, input.identifier, input.pin ?? '');
        employee = Array.isArray(result) ? result[0] : undefined;
        if (employee?.id && !employee.company_id) {
            employee = await readFirst(client, uid, 'hr.employee', [['id', '=', employee.id]], ['id', 'name', 'company_id', 'work_email']);
        }
    } else if (input.login_method === 'employee_id_pin') {
        const employeeId = Number.parseInt(input.identifier, 10);
        if (Number.isInteger(employeeId)) {
            employee = await readFirst(
                client,
                uid,
                'hr.employee',
                [['id', '=', employeeId], ['pin', '=', input.pin ?? '']],
                ['id', 'name', 'company_id', 'work_email'],
            );
        }
    } else if (input.login_method === 'work_email_pin') {
        employee = await readFirst(
            client,
            uid,
            'hr.employee',
            [['work_email', '=', input.work_email || input.identifier], ['pin', '=', input.pin ?? '']],
            ['id', 'name', 'company_id', 'work_email'],
        );
    }

    return {
        input,
        label,
        employee_id: employee?.id,
        name: employee?.name,
        work_email: employee?.work_email,
        company_id: relationId(employee?.company_id),
        login_ok: Boolean(employee?.id),
    };
}

export async function runTenantCertification(
    tenantId: string,
    tenantConfig: TenantConfig,
    input: RunCertificationInput,
): Promise<CertificationRun> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const mode = input.mode;
    const options = {
        include_attachments: input.options?.include_attachments ?? true,
        include_wrong_company_tests: input.options?.include_wrong_company_tests ?? true,
        include_optional_modules: input.options?.include_optional_modules ?? true,
    };
    const employeesInput = normalizeEmployees(input.employees);

    const client = getOdooClient(tenantId, tenantConfig);
    const scenarios: CertificationScenarioResult[] = [];
    const sanitizedErrors: CertificationError[] = [];
    const employees: ResolvedEmployee[] = [];
    let uid = 0;
    let version: number | null = null;

    async function scenario(
        meta: Omit<CertificationScenarioResult, 'duration_ms' | 'status'>,
        body: ScenarioBody,
    ): Promise<CertificationScenarioResult> {
        const started = Date.now();
        try {
            const result = await body();
            const entry: CertificationScenarioResult = {
                ...meta,
                status: result?.status ?? 'pass',
                duration_ms: Date.now() - started,
                ...(result?.message ? { message: result.message } : {}),
                ...(result?.details ? { details: sanitizeForCertification(result.details) } : {}),
                ...(result?.employee_id ? { employee_id: result.employee_id } : {}),
                ...(result?.request_type ? { request_type: result.request_type } : {}),
            };
            scenarios.push(entry);
            return entry;
        } catch (error: any) {
            const entry: CertificationScenarioResult = {
                ...meta,
                status: meta.severity === 'blocking' ? 'fail' : 'warn',
                duration_ms: Date.now() - started,
                message: errorMessage(error),
                details: sanitizeForCertification(error),
            };
            scenarios.push(entry);
            sanitizedErrors.push(scenarioError(meta.id, error));
            return entry;
        }
    }

    await scenario(
        { id: 'connection.authenticate', label: 'Odoo authentication works', group: 'connection', severity: 'blocking' },
        async () => {
            uid = await client.authenticate();
            return { details: { uid } };
        },
    );

    await scenario(
        { id: 'connection.version', label: 'Odoo version is detected', group: 'connection', severity: 'warning' },
        async () => {
            if (!uid) throw new Error('Skipped because authentication failed');
            version = await client.getVersion();
            if (!version) return { status: 'warn', message: 'Version probe returned no value' };
            return { details: { odoo_version: version } };
        },
    );

    await scenario(
        { id: 'connection.company_read', label: 'Integration user can read companies', group: 'connection', severity: 'blocking' },
        async () => {
            if (!uid) throw new Error('Skipped because authentication failed');
            const companies: any = await client.searchRead(uid, 'res.company', [], ['id', 'name'], { silent: true, limit: 5 });
            if (!Array.isArray(companies) || companies.length === 0) throw new Error('No readable Odoo companies found');
            return { details: { count: companies.length } };
        },
    );

    await scenario(
        { id: 'connection.schema_core', label: 'Core schema fetch works', group: 'connection', severity: 'blocking' },
        async () => {
            if (!uid) throw new Error('Skipped because authentication failed');
            const schema: any = await client.getSchema(uid, 'hr.expense');
            if (!schema || Object.keys(schema).length === 0) throw new Error('hr.expense schema is empty');
            return { details: { fields: Object.keys(schema).length } };
        },
    );

    for (const [index, employeeInput] of employeesInput.entries()) {
        await scenario(
            {
                id: `employee.${index + 1}.login`,
                label: `${employeeInput.label || `Employee ${index + 1}`} login works`,
                group: 'employee',
                severity: 'blocking',
            },
            async () => {
                if (!uid) throw new Error('Skipped because authentication failed');
                const resolved = await resolveEmployee(tenantId, client, uid, employeeInput, index);
                employees.push(resolved);
                if (!resolved.login_ok || !resolved.employee_id) throw new Error('Employee credentials did not resolve to a valid employee');
                return {
                    employee_id: resolved.employee_id,
                    details: {
                        login_method: resolved.input.login_method,
                        company_id: resolved.company_id ?? null,
                        work_email_present: Boolean(resolved.work_email),
                    },
                };
            },
        );

        const resolved = employees[index];
        if (!resolved?.employee_id) continue;

        await scenario(
            {
                id: `employee.${resolved.employee_id}.profile`,
                label: `${resolved.label} can fetch own profile`,
                group: 'employee',
                severity: 'blocking',
                employee_id: resolved.employee_id,
            },
            async () => {
                const profile = await readFirst(client, uid, 'hr.employee', [['id', '=', resolved.employee_id]], ['id', 'name', 'company_id', 'work_email']);
                if (!profile?.id) throw new Error('Employee profile not readable');
                return { employee_id: resolved.employee_id, details: { company_id: relationId(profile.company_id) } };
            },
        );

        await scenario(
            {
                id: `company.${resolved.employee_id}.valid_context`,
                label: `${resolved.label} company context is accepted`,
                group: 'company',
                severity: 'blocking',
                employee_id: resolved.employee_id,
            },
            async () => {
                const result = await assertEmployeeCanUseCompany(client, uid, resolved.employee_id!, resolved.company_id ?? null);
                if (result.fallback) {
                    return {
                        status: 'warn',
                        message: 'Employee has no resolvable company; integration-user fallback scope was used',
                        employee_id: resolved.employee_id,
                        details: result,
                    };
                }
                return { employee_id: resolved.employee_id, details: result };
            },
        );

        if (options.include_wrong_company_tests) {
            await scenario(
                {
                    id: `security.${resolved.employee_id}.wrong_company`,
                    label: `${resolved.label} crafted wrong company is rejected`,
                    group: 'security',
                    severity: 'blocking',
                    employee_id: resolved.employee_id,
                },
                async () => {
                    const companies: any = await client.searchRead(uid, 'res.company', [], ['id'], { silent: true, limit: 20 });
                    const wrong = Array.isArray(companies)
                        ? companies.map((c: any) => c.id).find((id: number) => id !== resolved.company_id)
                        : null;
                    if (!wrong) return { status: 'skipped', message: 'No alternate company available to test' };
                    try {
                        await assertEmployeeCanUseCompany(client, uid, resolved.employee_id!, wrong);
                    } catch (error: any) {
                        return { employee_id: resolved.employee_id, details: { rejected_company_id: wrong, code: error.code } };
                    }
                    throw new Error('Wrong company was accepted for this employee');
                },
            );
        }
    }

    for (const model of SCHEMA_MODELS) {
        await scenario(
            {
                id: `schema.${model}`,
                label: `${model} custom-field compatibility`,
                group: 'schema',
                severity: REQUIRED_MODELS.has(model) ? 'blocking' : 'warning',
                request_type: model,
            },
            async () => {
                if (!uid) throw new Error('Skipped because authentication failed');
                const report = await getCustomFieldReport(tenantId, client, uid, model);
                const unsupportedRequired = Object.keys(report.unsupported_required_fields);
                const unsupportedOptional = Object.keys(report.unsupported_fields).filter(key => !unsupportedRequired.includes(key));
                if (!report.schema_available) {
                    return {
                        status: REQUIRED_MODELS.has(model) ? 'fail' : 'warn',
                        message: `${model} schema is unavailable`,
                        details: { schema_available: false },
                    };
                }
                if (unsupportedRequired.length > 0) {
                    return {
                        status: 'fail',
                        message: `Unsupported required custom fields: ${unsupportedRequired.join(', ')}`,
                        details: {
                            unsupported_required_fields: unsupportedRequired,
                            supported_custom_fields: Object.keys(report.custom_fields),
                        },
                    };
                }
                if (unsupportedOptional.length > 0) {
                    return {
                        status: 'warn',
                        message: `Unsupported optional custom fields: ${unsupportedOptional.join(', ')}`,
                        details: { unsupported_fields: unsupportedOptional },
                    };
                }
                return {
                    details: {
                        supported_custom_fields: Object.keys(report.custom_fields),
                        schema_cached_at: report.schema_cached_at,
                    },
                };
            },
        );
    }

    for (const picker of REQUIRED_PICKERS) {
        await scenario(
            {
                id: `picker.${picker.id}`,
                label: picker.label,
                group: 'picker',
                severity: 'blocking',
                request_type: picker.requestType,
            },
            async () => {
                if (!uid) throw new Error('Skipped because authentication failed');
                const records: any = await client.searchRead(uid, picker.model, picker.domain, picker.fields, { silent: true, limit: 10 });
                if (!Array.isArray(records) || records.length === 0) throw new Error(`${picker.model} returned no requestable choices`);
                return { details: { count: records.length } };
            },
        );
    }

    if (options.include_optional_modules) {
        for (const picker of OPTIONAL_PICKERS) {
            await scenario(
                {
                    id: `picker.${picker.id}`,
                    label: picker.label,
                    group: 'picker',
                    severity: 'warning',
                    request_type: picker.requestType,
                },
                async () => {
                    if (!uid) throw new Error('Skipped because authentication failed');
                    const records: any = await client.searchRead(uid, picker.model, picker.domain, picker.fields, { silent: true, limit: 10 });
                    if (!Array.isArray(records) || records.length === 0) {
                        return { status: 'warn', message: `${picker.model} returned no choices` };
                    }
                    return { details: { count: records.length } };
                },
            );
        }
    }

    await scenario(
        { id: 'preflight.safe_mode_no_write', label: 'Safe mode does not create records', group: 'preflight', severity: 'blocking' },
        async () => ({ status: mode === 'safe' ? 'pass' : 'skipped', message: mode === 'safe' ? undefined : 'Write mode selected' }),
    );

    if (options.include_attachments) {
        const validAttachmentResult = attachmentsSchema.safeParse([
            { name: 'certification.png', data: TINY_PNG, mimetype: 'image/png' },
            { name: 'certification.pdf', data: TINY_PDF, mimetype: 'application/pdf' },
        ]);
        await scenario(
            { id: 'attachment.valid_png_pdf', label: 'Valid PNG and PDF attachments pass validation', group: 'attachment', severity: 'blocking' },
            async () => {
                if (!validAttachmentResult.success) throw new Error(validAttachmentResult.error.message);
            },
        );
        await scenario(
            { id: 'attachment.invalid_base64', label: 'Invalid base64 is rejected', group: 'attachment', severity: 'blocking' },
            async () => {
                const invalid = attachmentsSchema.safeParse([{ name: 'bad.png', data: 'not-base64!!!', mimetype: 'image/png' }]);
                if (invalid.success) throw new Error('Invalid base64 was accepted');
            },
        );
        await scenario(
            { id: 'attachment.unsupported_mime', label: 'Unsupported MIME is rejected', group: 'attachment', severity: 'blocking' },
            async () => {
                const invalid = attachmentsSchema.safeParse([{ name: 'bad.exe', data: TINY_PNG, mimetype: 'application/x-msdownload' }]);
                if (invalid.success) throw new Error('Unsupported MIME was accepted');
            },
        );
    }

    if (mode === 'write' && uid) {
        const primary = employees.find(e => e.login_ok && e.employee_id);
        if (!primary?.employee_id) {
            await scenario(
                { id: 'write.no_employee', label: 'Write mode has a resolved employee', group: 'write', severity: 'blocking' },
                async () => { throw new Error('No resolved employee available for write scenarios'); },
            );
        } else {
            const context = certContext(primary.company_id);
            const label = `[SHADOW-CERTIFICATION]`;

            await scenario(
                { id: 'write.expense', label: 'Create labeled expense request', group: 'write', severity: 'blocking', request_type: 'expense', employee_id: primary.employee_id },
                async () => {
                    const product = await readFirst(client, uid, 'product.product', [['can_be_expensed', '=', true]], ['id', 'name'], context);
                    if (!product?.id) throw new Error('No expensable product available');
                    const amountField = (version ?? 16) >= 17 ? 'total_amount' : 'price_unit';
                    const id = await client.createRecord(uid, 'hr.expense', {
                        name: `${label} expense ${runId}`,
                        employee_id: primary.employee_id,
                        product_id: product.id,
                        [amountField]: 1,
                        quantity: 1,
                        date: new Date().toISOString().slice(0, 10),
                    }, context);
                    if (options.include_attachments && typeof id === 'number') {
                        await client.uploadAttachments(uid, [
                            { name: 'shadow-certification.png', data: TINY_PNG, mimetype: 'image/png' },
                        ], 'hr.expense', id, context);
                    }
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.time_off', label: 'Create labeled time-off request', group: 'write', severity: 'blocking', request_type: 'time_off', employee_id: primary.employee_id },
                async () => {
                    const leaveType = await readFirst(client, uid, 'hr.leave.type', [], ['id', 'name'], context);
                    if (!leaveType?.id) throw new Error('No leave type available');
                    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    const id = await client.createRecord(uid, 'hr.leave', {
                        name: `${label} time_off ${runId}`,
                        employee_id: primary.employee_id,
                        holiday_status_id: leaveType.id,
                        request_date_from: start,
                        request_date_to: start,
                        date_from: `${start} 08:00:00`,
                        date_to: `${start} 17:00:00`,
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.timesheet', label: 'Create labeled timesheet line when available', group: 'write', severity: 'warning', request_type: 'timesheet', employee_id: primary.employee_id },
                async () => {
                    const project = await readFirst(client, uid, 'project.project', [], ['id', 'name'], context);
                    if (!project?.id) return { status: 'warn', message: 'No project available for timesheet write test' };
                    const id = await client.createRecord(uid, 'account.analytic.line', {
                        name: `${label} timesheet ${runId}`,
                        employee_id: primary.employee_id,
                        project_id: project.id,
                        unit_amount: 0.25,
                        date: new Date().toISOString().slice(0, 10),
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.helpdesk', label: 'Create labeled helpdesk ticket when available', group: 'write', severity: 'warning', request_type: 'helpdesk', employee_id: primary.employee_id },
                async () => {
                    const id = await client.createRecord(uid, 'helpdesk.ticket', {
                        name: `${label} helpdesk ${runId}`,
                        description: 'Created by Shadow Portal tenant certification write mode.',
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.maintenance', label: 'Create labeled maintenance request when available', group: 'write', severity: 'warning', request_type: 'maintenance', employee_id: primary.employee_id },
                async () => {
                    const id = await client.createRecord(uid, 'maintenance.request', {
                        name: `${label} maintenance ${runId}`,
                        description: 'Created by Shadow Portal tenant certification write mode.',
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.attendance_correction', label: 'Create labeled attendance correction when available', group: 'write', severity: 'warning', request_type: 'attendance_correction', employee_id: primary.employee_id },
                async () => {
                    const now = new Date();
                    const checkOut = new Date(now.getTime() - 60 * 60 * 1000);
                    const checkIn = new Date(checkOut.getTime() - 15 * 60 * 1000);
                    const id = await client.createRecord(uid, 'hr.attendance', {
                        employee_id: primary.employee_id,
                        check_in: checkIn.toISOString().slice(0, 19).replace('T', ' '),
                        check_out: checkOut.toISOString().slice(0, 19).replace('T', ' '),
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );

            await scenario(
                { id: 'write.attendance_overtime', label: 'Create labeled attendance overtime when available', group: 'write', severity: 'warning', request_type: 'attendance_overtime', employee_id: primary.employee_id },
                async () => {
                    const id = await client.createRecord(uid, 'hr.attendance.overtime', {
                        employee_id: primary.employee_id,
                        date: new Date().toISOString().slice(0, 10),
                        duration: 0.25,
                        reason: `${label} overtime ${runId}`,
                    }, context);
                    return { employee_id: primary.employee_id, details: { created_id: id } };
                },
            );
        }
    }

    const status = statusFromScenarios(scenarios);
    const run: CertificationRun = {
        id: runId,
        tenantId,
        mode,
        status,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        odoo_version: version,
        summary: summarize(scenarios),
        employees: employees.map(e => ({
            label: e.label,
            employee_id: e.employee_id,
            login_ok: e.login_ok,
            company_id: e.company_id ?? null,
        })),
        scenarios,
        sanitized_errors: sanitizedErrors,
    };
    return run;
}
