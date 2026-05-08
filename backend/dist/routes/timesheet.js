"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timesheetRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const router = (0, express_1.Router)();
// ── Schema ────────────────────────────────────────────────────────────────────
const createTimesheetSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    project_id: zod_1.z.number(),
    task_id: zod_1.z.number().optional(),
    date: zod_1.z.string(), // YYYY-MM-DD
    unit_amount: zod_1.z.number(), // hours, e.g. 2.5
    name: zod_1.z.string(), // description of work done
});
// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const parsedEmployeeId = parseInt(employeeId);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }
        const uid = await client.authenticate();
        const entries = await client.searchRead(uid, 'account.analytic.line', [
            ['employee_id', '=', parsedEmployeeId],
            ['project_id', '!=', false],
        ], ['id', 'name', 'project_id', 'task_id', 'date', 'unit_amount', 'create_date']);
        const sorted = Array.isArray(entries)
            ? entries
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50)
            : [];
        res.json({ entries: sorted });
    }
    catch (error) {
        console.error('Fetch Timesheet Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/projects', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        const projects = await client.searchRead(uid, 'project.project', [['active', '=', true]], ['id', 'name']);
        res.json({ projects: Array.isArray(projects) ? projects : [] });
    }
    catch (error) {
        console.error('Fetch Projects Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/tasks', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const projectId = req.query.project_id;
        if (!projectId) {
            return res.status(400).json({ error: 'project_id query parameter required' });
        }
        const parsedProjectId = parseInt(projectId);
        if (isNaN(parsedProjectId)) {
            return res.status(400).json({ error: 'Invalid project_id' });
        }
        const uid = await client.authenticate();
        const tasks = await client.searchRead(uid, 'project.task', [['project_id', '=', parsedProjectId], ['active', '=', true]], ['id', 'name']);
        res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
    }
    catch (error) {
        console.error('Fetch Tasks Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const body = createTimesheetSchema.parse(req.body);
        const uid = await client.authenticate();
        const projects = await client.searchRead(uid, 'project.project', [['id', '=', body.project_id]], ['id', 'name']);
        if (!Array.isArray(projects) || projects.length === 0) {
            return res.status(400).json({ error: 'Project not found' });
        }
        let analyticAccountId = false;
        try {
            const projectAccount = await client.searchRead(uid, 'project.project', [['id', '=', body.project_id]], ['id', 'analytic_account_id'], true);
            if (Array.isArray(projectAccount) && projectAccount[0]) {
                const a = projectAccount[0].analytic_account_id;
                analyticAccountId = Array.isArray(a) ? a[0]
                    : (typeof a === 'number' ? a : false);
            }
        }
        catch {
            // Field doesn't exist on this Odoo version — skip silently
        }
        const recordData = {
            name: body.name,
            employee_id: body.employee_id,
            project_id: body.project_id,
            date: body.date,
            unit_amount: body.unit_amount,
        };
        if (analyticAccountId)
            recordData.account_id = analyticAccountId;
        if (body.task_id)
            recordData.task_id = body.task_id;
        const newId = await client.createRecord(uid, 'account.analytic.line', recordData);
        res.json({ status: 'success', id: newId });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Create Timesheet Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.timesheetRouter = router;
