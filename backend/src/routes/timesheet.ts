import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { getCustomFieldReport, getCustomFields, validatePayload, validateRequiredCustomFields } from '../lib/schemaCache';
import { sendOdooError } from '../odoo/parseError';
import { buildOdooContext, buildReadContext, getAuthenticatedEmployeeId } from '../lib/authContext';
import { companyCompatible } from '../lib/odooCompatibility';

const router = Router();
const TIME_OFF_TASK_ERROR = 'This task is linked to a time off type. Please choose a different task or leave task blank.';

// ── Schema ────────────────────────────────────────────────────────────────────

const createTimesheetSchema = z.object({
    employee_id: z.number(),
    project_id: z.number(),
    task_id: z.number().optional(),
    date: z.string(),          // YYYY-MM-DD
    unit_amount: z.number(),   // hours, e.g. 2.5
    name: z.string(),          // description of work done
    custom_values: z.record(z.string(), z.any()).optional(), // tenant-specific x_ custom fields
});

function taskIsLinkedToTimeOff(task: any): boolean {
    return Boolean(task?.leave_type_id || task?.time_off_type_id || task?.holiday_status_id);
}

function companyDomain(companyId: number | null | undefined): any[] {
    return companyId ? ['|', ['company_id', '=', false], ['company_id', '=', companyId]] : [];
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const parsedEmployeeId = getAuthenticatedEmployeeId(req, req.query.employee_id);

        const uid = await client.authenticate();
        const customFields = await getCustomFields(tenantId, client, uid, 'account.analytic.line');
        const customFieldNames = Object.keys(customFields);

        let entries: any;
        try {
            entries = await client.searchRead(
                uid,
                'account.analytic.line',
                [
                    ['employee_id', '=', parsedEmployeeId],
                    ['project_id', '!=', false],
                ],
                ['id', 'name', 'project_id', 'task_id', 'date', 'unit_amount', 'create_date', ...customFieldNames]
            );
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('invalid field')) {
                return res.json({ entries: [], available: false, message: 'Timesheet module not available on this Odoo instance.' });
            }
            throw e;
        }

        const sorted = Array.isArray(entries)
            ? entries
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50)
            : [];

        res.json({ entries: sorted, custom_fields: customFields });
    } catch (error: any) {
        console.error('Fetch Timesheet Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/projects', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();
        const ctx = await buildReadContext(req, client, uid);
        const employeeCompanyId = (ctx.company_id as number | undefined) ?? null;
        const domain = [['active', '=', true], ...companyDomain(employeeCompanyId)];
        let projects: any;
        try {
            projects = await client.searchRead(
                uid, 'project.project', domain, ['id', 'name', 'company_id'],
                { context: ctx }
            );
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist')) {
                return res.json({ projects: [], available: false, message: 'Project module not available on this Odoo instance.' });
            }
            throw e;
        }
        const safeProjects = Array.isArray(projects)
            ? projects.filter((project: any) => companyCompatible(project.company_id, employeeCompanyId))
            : [];
        res.json({ projects: safeProjects });
    } catch (error: any) {
        console.error('Fetch Projects Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/tasks', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const projectId = req.query.project_id;
        if (!projectId) {
            return res.status(400).json({ error: 'project_id query parameter required' });
        }
        const parsedProjectId = parseInt(projectId as string);
        if (isNaN(parsedProjectId)) {
            return res.status(400).json({ error: 'Invalid project_id' });
        }

        const uid = await client.authenticate();
        const ctx = await buildReadContext(req, client, uid);
        const employeeCompanyId = (ctx.company_id as number | undefined) ?? null;

        const projectCheck: any = await client.searchRead(
            uid,
            'project.project',
            [['id', '=', parsedProjectId], ...companyDomain(employeeCompanyId)],
            ['id', 'company_id'],
            { silent: true, context: ctx }
        ).catch(() => []);
        if (!Array.isArray(projectCheck) || projectCheck.length === 0 || !companyCompatible(projectCheck[0].company_id, employeeCompanyId)) {
            return res.status(422).json({ error: 'Project is not available for your company.' });
        }

        let tasks: any = [];
        try {
            tasks = await client.searchRead(
                uid, 'project.task',
                [['project_id', '=', parsedProjectId], ['active', '=', true]],
                ['id', 'name', 'leave_type_id', 'time_off_type_id', 'holiday_status_id'],
                { silent: true, context: ctx }
            );
        } catch {
            tasks = await client.searchRead(
                uid, 'project.task',
                [['project_id', '=', parsedProjectId], ['active', '=', true]],
                ['id', 'name'],
                { silent: true, context: ctx }
            );
        }
        const safeTasks = Array.isArray(tasks)
            ? tasks
                .map((task: any) => ({
                    ...task,
                    requestable: !taskIsLinkedToTimeOff(task),
                    ...(taskIsLinkedToTimeOff(task) ? { unavailable_reason: TIME_OFF_TASK_ERROR } : {}),
                }))
                .filter((task: any) => task.requestable !== false)
            : [];
        res.json({ tasks: safeTasks });
    } catch (error: any) {
        console.error('Fetch Tasks Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/form-schema', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();
        res.json(await getCustomFieldReport(tenantId, client, uid, 'account.analytic.line'));
    } catch (error: any) {
        console.error('Fetch Timesheet Form Schema Error:', error);
        res.json({ custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null });
    }
});

router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = { ...createTimesheetSchema.parse(req.body), employee_id: getAuthenticatedEmployeeId(req, req.body?.employee_id) };
        const uid = await client.authenticate();

        const ctx = await buildOdooContext(req, client, uid, body.employee_id);
        const employeeCompanyId = (ctx.company_id as number | undefined) ?? null;

        const projects: any = await client.searchRead(
            uid,
            'project.project',
            [['id', '=', body.project_id], ...companyDomain(employeeCompanyId)],
            ['id', 'name', 'company_id'],
            { context: ctx }
        );

        if (!Array.isArray(projects) || projects.length === 0 || !companyCompatible(projects[0].company_id, employeeCompanyId)) {
            return res.status(422).json({ error: 'Project is not available for your company.' });
        }

        let analyticAccountId: number | false = false;
        try {
            const projectAccount: any = await client.searchRead(
                uid, 'project.project', [['id', '=', body.project_id]], ['id', 'analytic_account_id'], true
            );
            if (Array.isArray(projectAccount) && projectAccount[0]) {
                const a = projectAccount[0].analytic_account_id;
                analyticAccountId = Array.isArray(a) ? a[0]
                    : (typeof a === 'number' ? a : false);
            }
        } catch {
            // Field doesn't exist on this Odoo version — skip silently
        }

        const recordData: Record<string, any> = {
            name: body.name,
            employee_id: body.employee_id,
            project_id: body.project_id,
            date: body.date,
            unit_amount: body.unit_amount,
        };

        if (employeeCompanyId) recordData.company_id = employeeCompanyId;
        if (analyticAccountId) recordData.account_id = analyticAccountId;
        if (body.task_id) recordData.task_id = body.task_id;
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(recordData, body.custom_values);
        }

        // Enforce required custom fields up-front for a clear error message.
        const tsCustomFields = await getCustomFields(tenantId, client, uid, 'account.analytic.line');
        const missingCustom = validateRequiredCustomFields(tsCustomFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }

        // Pre-validate payload against live Odoo schema
        const validation = await validatePayload(tenantId, client, uid, 'account.analytic.line', recordData);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: validation.missing,
                invalid_values: validation.invalid,
            });
        }

        let newId: number;
        try {
            newId = await client.createRecord(uid, 'account.analytic.line', recordData, ctx) as number;
        } catch (createErr: any) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('invalid field') || msg.includes('object')) {
                return res.json({ available: false, message: 'Timesheet module not available on this Odoo instance.' });
            }
            if (msg.includes('linked to a time off type') || msg.includes('time off application')) {
                return res.status(422).json({ error: TIME_OFF_TASK_ERROR });
            }
            throw createErr;
        }

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        return sendOdooError(res, error, 'Create Timesheet');
    }
});

export const timesheetRouter = router;
