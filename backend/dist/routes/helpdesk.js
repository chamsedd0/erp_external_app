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
const attachments_1 = require("../lib/attachments");
Object.defineProperty(exports, "attachmentSchema", { enumerable: true, get: function () { return attachments_1.attachmentSchema; } });
const odooCompatibility_1 = require("../lib/odooCompatibility");
const router = (0, express_1.Router)();
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
    // Customer/partner contact fields — optional and retained for API
    // compatibility. The mobile app no longer collects or sends these.
    partner_name: zod_1.z.string().optional(),
    partner_email: zod_1.z.string().email().optional(),
    partner_phone: zod_1.z.string().optional(),
    custom_values: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(), // tenant-specific x_ custom fields
    attachments: attachments_1.attachmentsSchema,
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const types = await client.searchRead(uid, 'helpdesk.ticket.type', [], ['id', 'name'], { silent: true, context: ctx });
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const tags = await client.searchRead(uid, 'helpdesk.tag', [], ['id', 'name', 'color'], { silent: true, context: ctx });
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const employeeCompanyId = ctx.company_id ?? null;
        // res.users is NOT constrained by allowed_company_ids, so scope it
        // explicitly to the employee's company (or company-less users). The
        // company field on res.users is `company_ids` (many2many); on instances
        // where that field differs, fall back to the unscoped active/share query.
        const baseDomain = [['active', '=', true], ['share', '=', false]];
        let agents;
        if (employeeCompanyId) {
            agents = await client.searchRead(uid, 'res.users', [...baseDomain, '|', ['company_ids', '=', false], ['company_ids', 'in', [employeeCompanyId]]], ['id', 'name'], { silent: true, context: ctx }).catch(() => null);
        }
        if (!Array.isArray(agents)) {
            agents = await client.searchRead(uid, 'res.users', baseDomain, ['id', 'name'], { silent: true, context: ctx });
        }
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const employeeCompanyId = ctx.company_id ?? null;
        const teams = await client.searchRead(uid, 'helpdesk.team', (0, odooCompatibility_1.companyDomain)(employeeCompanyId), ['id', 'name', 'company_id'], { silent: true, context: ctx });
        const scoped = Array.isArray(teams) ? teams.filter((team) => (0, odooCompatibility_1.companyCompatible)(team.company_id, employeeCompanyId)) : [];
        res.json({ available: true, teams: scoped });
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
router.get('/form-schema', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        res.json(await (0, schemaCache_1.getCustomFieldReport)(tenantId, client, uid, 'helpdesk.ticket'));
    }
    catch (error) {
        console.error('Fetch Helpdesk Form Schema Error:', error);
        res.json({ custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null });
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
        const ctx = await (0, authContext_1.buildOdooContext)(req, client, uid, body.employee_id);
        const employeeCompanyId = ctx.company_id ?? null;
        // Re-validate a client-supplied team_id against the employee company.
        // Fail closed: the team MUST be found and verifiably belong to the
        // employee's company (or be global). A crafted/unverifiable team_id → 422.
        if (body.team_id) {
            let teams = [];
            let lookupOk = true;
            try {
                const result = await client.searchRead(uid, 'helpdesk.team', [['id', '=', body.team_id]], ['id', 'company_id'], { silent: true, context: ctx });
                teams = Array.isArray(result) ? result : [];
            }
            catch {
                lookupOk = false;
            }
            if (!lookupOk || teams.length === 0 ||
                !(0, odooCompatibility_1.companyAllowedStrict)(teams[0], employeeCompanyId, true)) {
                return res.status(422).json({ error: 'This helpdesk team is not available for your company.' });
            }
        }
        const ticketData = {
            name: body.name,
            description: body.description || '',
        };
        // Pin the record to the employee's own company (defense-in-depth).
        if (employeeCompanyId)
            ticketData.company_id = employeeCompanyId;
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
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(ticketData, body.custom_values);
        }
        // Enforce required custom fields up-front for a clear error message.
        const hdCustomFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'helpdesk.ticket');
        const missingCustom = (0, schemaCache_1.validateRequiredCustomFields)(hdCustomFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }
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
            newId = await client.createRecord(uid, 'helpdesk.ticket', { ...ticketData, ...optionalFields }, ctx);
        }
        catch (createErr) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes('ticket_type_id') || msg.includes('tag_ids') || msg.includes('invalid field')) {
                console.warn('[helpdesk] optional fields rejected, retrying without ticket_type_id/tag_ids:', msg);
                newId = await client.createRecord(uid, 'helpdesk.ticket', ticketData, ctx);
            }
            else {
                throw createErr;
            }
        }
        let failedAttachments = [];
        if (body.attachments && body.attachments.length > 0) {
            const result = await client.uploadAttachments(uid, body.attachments, 'helpdesk.ticket', newId, ctx);
            failedAttachments = result?.failed ?? [];
        }
        res.json({
            status: 'success',
            id: newId,
            available: true,
            ...(failedAttachments.length > 0 ? { partial_success: true, failed_attachments: failedAttachments } : {}),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Helpdesk Ticket');
    }
});
exports.helpdeskRouter = router;
