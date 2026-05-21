"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helpdeskRouter = exports.attachmentSchema = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
const router = (0, express_1.Router)();
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Shared attachment schema — used by helpdesk and maintenance */
exports.attachmentSchema = zod_1.z.object({
    name: zod_1.z.string(),
    data: zod_1.z.string(), // base64 encoded file content
    mimetype: zod_1.z.string(), // e.g. 'image/jpeg', 'application/pdf'
});
/**
 * Runtime check: verify the helpdesk.ticket model is accessible.
 * Returns false if the module is not installed (Community Edition or module not enabled).
 */
const isHelpdeskAvailable = async (client, uid) => {
    try {
        await client.searchRead(uid, 'helpdesk.ticket', [['id', '=', 0]], ['id'], true);
        return true;
    }
    catch {
        return false;
    }
};
// ── Schema ────────────────────────────────────────────────────────────────────
const createHelpdeskSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    name: zod_1.z.string().min(1, 'Subject is required'),
    description: zod_1.z.string().optional(),
    team_id: zod_1.z.number().optional(),
    user_id: zod_1.z.number().optional(),
    priority: zod_1.z.enum(['0', '1', '2', '3']).optional(),
    ticket_type_id: zod_1.z.number().optional(),
    tag_ids: zod_1.z.array(zod_1.z.number()).optional(),
    partner_name: zod_1.z.string().optional(),
    partner_email: zod_1.z.string().email().optional(),
    partner_phone: zod_1.z.string().optional(),
    attachments: zod_1.z.array(exports.attachmentSchema).max(3).optional(),
});
// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/ticket-types', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, types: [] });
        }
        const types = await client.searchRead(uid, 'helpdesk.ticket.type', [], ['id', 'name'], true);
        res.json({ available: true, types: Array.isArray(types) ? types : [] });
    }
    catch (error) {
        console.error('Fetch Helpdesk Ticket Types Error:', error);
        res.json({ available: false, types: [], message: error.message });
    }
});
router.get('/tags', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, tags: [] });
        }
        const tags = await client.searchRead(uid, 'helpdesk.tag', [], ['id', 'name', 'color'], true);
        res.json({ available: true, tags: Array.isArray(tags) ? tags : [] });
    }
    catch (error) {
        console.error('Fetch Helpdesk Tags Error:', error);
        res.json({ available: false, tags: [], message: error.message });
    }
});
router.get('/agents', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, agents: [] });
        }
        const agents = await client.searchRead(uid, 'res.users', [['active', '=', true], ['share', '=', false]], ['id', 'name'], true);
        // Limit to 50 to keep response size reasonable
        const list = Array.isArray(agents) ? agents.slice(0, 50) : [];
        res.json({ available: true, agents: list });
    }
    catch (error) {
        console.error('Fetch Helpdesk Agents Error:', error);
        res.json({ available: false, agents: [], message: error.message });
    }
});
router.get('/teams', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, teams: [] });
        }
        const teams = await client.searchRead(uid, 'helpdesk.team', [], ['id', 'name']);
        res.json({ available: true, teams: Array.isArray(teams) ? teams : [] });
    }
    catch (error) {
        console.error('Fetch Helpdesk Teams Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const parsedEmployeeId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, tickets: [] });
        }
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'helpdesk.ticket');
        const customFieldNames = Object.keys(customFields);
        const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', parsedEmployeeId]], ['id', 'name', 'user_id']);
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        let domain = [];
        const employee = employees[0];
        if (employee.user_id && Array.isArray(employee.user_id)) {
            const users = await client.searchRead(uid, 'res.users', [['id', '=', employee.user_id[0]]], ['id', 'partner_id']);
            if (Array.isArray(users) && users[0]?.partner_id) {
                domain = [['partner_id', '=', users[0].partner_id[0]]];
            }
        }
        if (domain.length === 0) {
            return res.json({ available: true, tickets: [], custom_fields: customFields });
        }
        const tickets = await client.searchRead(uid, 'helpdesk.ticket', domain, ['id', 'name', 'description', 'stage_id', 'team_id', 'create_date', 'partner_id', ...customFieldNames]);
        const sorted = Array.isArray(tickets)
            ? tickets
                .sort((a, b) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
                .slice(0, 30)
            : [];
        res.json({ available: true, tickets: sorted, custom_fields: customFields });
    }
    catch (error) {
        console.error('Fetch Helpdesk Tickets Error:', error);
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
        const body = { ...createHelpdeskSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, message: 'Helpdesk module not available on this Odoo instance' });
        }
        const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', body.employee_id]], ['id', 'name', 'user_id', 'work_email']);
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ error: 'Employee not found' });
        }
        const employee = employees[0];
        let partnerId = false;
        if (employee.user_id && Array.isArray(employee.user_id)) {
            const users = await client.searchRead(uid, 'res.users', [['id', '=', employee.user_id[0]]], ['id', 'partner_id']);
            if (Array.isArray(users) && users[0]?.partner_id) {
                partnerId = users[0].partner_id[0];
            }
        }
        const ticketData = {
            name: body.name,
            description: body.description || '',
        };
        if (partnerId)
            ticketData.partner_id = partnerId;
        if (body.team_id)
            ticketData.team_id = body.team_id;
        if (body.user_id)
            ticketData.user_id = body.user_id;
        if (body.priority)
            ticketData.priority = body.priority;
        if (body.partner_name)
            ticketData.partner_name = body.partner_name;
        if (body.partner_email)
            ticketData.partner_email = body.partner_email;
        if (body.partner_phone)
            ticketData.partner_phone = body.partner_phone;
        // ticket_type_id and tag_ids may not exist on all Enterprise versions — retry without if rejected
        const optionalFields = {};
        if (body.ticket_type_id)
            optionalFields.ticket_type_id = body.ticket_type_id;
        if (body.tag_ids && body.tag_ids.length > 0)
            optionalFields.tag_ids = [[6, 0, body.tag_ids]];
        // Pre-validate base ticket data against live Odoo schema
        const ticketValidation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'helpdesk.ticket', ticketData);
        if (!ticketValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: ticketValidation.missing,
                invalid_values: ticketValidation.invalid,
            });
        }
        let newId;
        try {
            newId = await client.createRecord(uid, 'helpdesk.ticket', { ...ticketData, ...optionalFields });
        }
        catch (createErr) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes('ticket_type_id') || msg.includes('tag_ids') || msg.includes('invalid field')) {
                console.warn('[helpdesk] optional fields rejected, retrying without ticket_type_id/tag_ids:', msg);
                newId = await client.createRecord(uid, 'helpdesk.ticket', ticketData);
            }
            else {
                throw createErr;
            }
        }
        if (body.attachments && body.attachments.length > 0) {
            await client.uploadAttachments(uid, body.attachments, 'helpdesk.ticket', newId);
        }
        res.json({ status: 'success', id: newId, available: true });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Helpdesk Ticket');
    }
});
exports.helpdeskRouter = router;
