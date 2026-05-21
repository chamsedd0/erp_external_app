"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timesheetRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
const router = (0, express_1.Router)();
const TIME_OFF_TASK_ERROR = 'This task is linked to a time off type. Please choose a different task or leave task blank.';
// ── Schema ────────────────────────────────────────────────────────────────────
const createTimesheetSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    project_id: zod_1.z.number(),
    task_id: zod_1.z.number().optional(),
    date: zod_1.z.string(), // YYYY-MM-DD
    unit_amount: zod_1.z.number(), // hours, e.g. 2.5
    name: zod_1.z.string(), // description of work done
});
function taskIsLinkedToTimeOff(task) {
    return Boolean(task?.leave_type_id || task?.time_off_type_id || task?.holiday_status_id);
}
// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const parsedEmployeeId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'account.analytic.line');
        const customFieldNames = Object.keys(customFields);
        let entries;
        try {
            entries = await client.searchRead(uid, 'account.analytic.line', [
                ['employee_id', '=', parsedEmployeeId],
                ['project_id', '!=', false],
            ], ['id', 'name', 'project_id', 'task_id', 'date', 'unit_amount', 'create_date', ...customFieldNames]);
        }
        catch (e) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('invalid field')) {
                return res.json({ entries: [], available: false, message: 'Timesheet module not available on this Odoo instance.' });
            }
            throw e;
        }
        const sorted = Array.isArray(entries)
            ? entries
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50)
            : [];
        res.json({ entries: sorted, custom_fields: customFields });
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
        let projects;
        try {
            projects = await client.searchRead(uid, 'project.project', [['active', '=', true]], ['id', 'name']);
        }
        catch (e) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist')) {
                return res.json({ projects: [], available: false, message: 'Project module not available on this Odoo instance.' });
            }
            throw e;
        }
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
        let tasks = [];
        try {
            tasks = await client.searchRead(uid, 'project.task', [['project_id', '=', parsedProjectId], ['active', '=', true]], ['id', 'name', 'leave_type_id', 'time_off_type_id', 'holiday_status_id'], true);
        }
        catch {
            tasks = await client.searchRead(uid, 'project.task', [['project_id', '=', parsedProjectId], ['active', '=', true]], ['id', 'name']);
        }
        const safeTasks = Array.isArray(tasks)
            ? tasks
                .map((task) => ({
                ...task,
                requestable: !taskIsLinkedToTimeOff(task),
                ...(taskIsLinkedToTimeOff(task) ? { unavailable_reason: TIME_OFF_TASK_ERROR } : {}),
            }))
                .filter((task) => task.requestable !== false)
            : [];
        res.json({ tasks: safeTasks });
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
        const body = { ...createTimesheetSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
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
        // Pre-validate payload against live Odoo schema
        const validation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'account.analytic.line', recordData);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: validation.missing,
                invalid_values: validation.invalid,
            });
        }
        let newId;
        try {
            newId = await client.createRecord(uid, 'account.analytic.line', recordData);
        }
        catch (createErr) {
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Timesheet');
    }
});
exports.timesheetRouter = router;
