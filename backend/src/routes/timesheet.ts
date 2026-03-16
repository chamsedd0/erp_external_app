import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';

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

/**
 * GET /timesheet?employee_id=X
 * Returns all timesheet entries (account.analytic.line) for the employee.
 * Sorted newest-first, limited to 50.
 */
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }

        const uid = await odooClient.authenticate();

        // account.analytic.line — use 'employee_id' domain filter
        // Note: 'project_id != false' ensures we only get timesheet lines (not accounting lines)
        const entries: any = await odooClient.searchRead(
            uid,
            'account.analytic.line',
            [
                ['employee_id', '=', parseInt(employeeId as string)],
                ['project_id', '!=', false],
            ],
            ['id', 'name', 'project_id', 'task_id', 'date', 'unit_amount', 'create_date']
        );

        const sorted = Array.isArray(entries)
            ? entries
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50)
            : [];

        res.json({ entries: sorted });
    } catch (error: any) {
        console.error('Fetch Timesheet Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /timesheet/projects
 * Returns all active projects.
 */
router.get('/projects', async (req, res) => {
    try {
        const uid = await odooClient.authenticate();
        const projects: any = await odooClient.searchRead(
            uid,
            'project.project',
            [['active', '=', true]],
            ['id', 'name']
        );
        res.json({ projects: Array.isArray(projects) ? projects : [] });
    } catch (error: any) {
        console.error('Fetch Projects Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /timesheet/tasks?project_id=X
 * Returns all active tasks for a given project.
 */
router.get('/tasks', async (req, res) => {
    try {
        const projectId = req.query.project_id;
        if (!projectId) {
            return res.status(400).json({ error: 'project_id query parameter required' });
        }

        const uid = await odooClient.authenticate();
        const tasks: any = await odooClient.searchRead(
            uid,
            'project.task',
            [
                ['project_id', '=', parseInt(projectId as string)],
                ['active', '=', true],
            ],
            ['id', 'name']
        );
        res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
    } catch (error: any) {
        console.error('Fetch Tasks Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /timesheet
 * Body: { employee_id, project_id, task_id?, date, unit_amount, name }
 * Creates a new account.analytic.line (timesheet entry).
 */
router.post('/', async (req, res) => {
    try {
        const body = createTimesheetSchema.parse(req.body);
        const uid = await odooClient.authenticate();

        // account.analytic.line requires 'account_id' (the analytic account).
        // In Odoo timesheets the project's analytic account is used.
        // We fetch it from project.project.
        const projects: any = await odooClient.searchRead(
            uid,
            'project.project',
            [['id', '=', body.project_id]],
            ['id', 'name', 'analytic_account_id']
        );

        if (!Array.isArray(projects) || projects.length === 0) {
            return res.status(400).json({ error: 'Project not found' });
        }

        const project = projects[0];

        // analytic_account_id may be a [id, name] tuple, a plain number, or false.
        // In Odoo 17+ this field is not always auto-populated on projects —
        // we attempt to set it but do NOT block submission if it's absent.
        // Odoo 17+ hr_timesheet can derive the account from project_id at write time.
        const analyticAccountId =
            Array.isArray(project.analytic_account_id)
                ? project.analytic_account_id[0]
                : (typeof project.analytic_account_id === 'number' ? project.analytic_account_id : false);

        const recordData: Record<string, any> = {
            name: body.name,
            employee_id: body.employee_id,
            project_id: body.project_id,
            date: body.date,
            unit_amount: body.unit_amount,
        };

        // Only include account_id when we can resolve it — Odoo 17+ may auto-compute it
        if (analyticAccountId) {
            recordData.account_id = analyticAccountId;
        }

        if (body.task_id) {
            recordData.task_id = body.task_id;
        }

        const newId = await odooClient.createRecord(uid, 'account.analytic.line', recordData);

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Create Timesheet Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const timesheetRouter = router;
