import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { getCustomFields, validatePayload } from '../lib/schemaCache';
import { sendOdooError } from '../odoo/parseError';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────

const createTimesheetSchema = z.object({
    employee_id: z.number(),
    project_id: z.number(),
    task_id: z.number().optional(),
    date: z.string(),          // YYYY-MM-DD
    unit_amount: z.number(),   // hours, e.g. 2.5
    name: z.string(),          // description of work done
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

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
        let projects: any;
        try {
            projects = await client.searchRead(
                uid, 'project.project', [['active', '=', true]], ['id', 'name']
            );
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist')) {
                return res.json({ projects: [], available: false, message: 'Project module not available on this Odoo instance.' });
            }
            throw e;
        }
        res.json({ projects: Array.isArray(projects) ? projects : [] });
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
        const tasks: any = await client.searchRead(
            uid, 'project.task',
            [['project_id', '=', parsedProjectId], ['active', '=', true]],
            ['id', 'name']
        );
        res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
    } catch (error: any) {
        console.error('Fetch Tasks Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = createTimesheetSchema.parse(req.body);
        const uid = await client.authenticate();

        const projects: any = await client.searchRead(
            uid, 'project.project', [['id', '=', body.project_id]], ['id', 'name']
        );

        if (!Array.isArray(projects) || projects.length === 0) {
            return res.status(400).json({ error: 'Project not found' });
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

        if (analyticAccountId) recordData.account_id = analyticAccountId;
        if (body.task_id) recordData.task_id = body.task_id;

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
            newId = await client.createRecord(uid, 'account.analytic.line', recordData) as number;
        } catch (createErr: any) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('invalid field') || msg.includes('object')) {
                return res.json({ available: false, message: 'Timesheet module not available on this Odoo instance.' });
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
