"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const helpdesk_1 = require("./helpdesk");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
const odooCompatibility_1 = require("../lib/odooCompatibility");
const router = (0, express_1.Router)();
// ── Helpers ───────────────────────────────────────────────────────────────────
const isMaintenanceAvailable = async (client, uid) => {
    try {
        await client.searchRead(uid, 'maintenance.request', [['id', '=', 0]], ['id'], true);
        return true;
    }
    catch {
        return false;
    }
};
const INCOMPATIBLE_MAINTENANCE_TEAM = 'No maintenance team is available for your employee company. Please contact your administrator.';
async function fetchMaintenanceTeams(client, uid) {
    try {
        const teams = await client.searchRead(uid, 'maintenance.team', [], ['id', 'name', 'company_id'], true);
        return Array.isArray(teams) ? teams : [];
    }
    catch {
        const teams = await client.searchRead(uid, 'maintenance.team', [], ['id', 'name']);
        return Array.isArray(teams) ? teams : [];
    }
}
// ── Schema ────────────────────────────────────────────────────────────────────
const createMaintenanceSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    name: zod_1.z.string().min(1, 'Request title is required'),
    description: zod_1.z.string().optional(),
    category_id: zod_1.z.number().optional(),
    maintenance_type: zod_1.z.enum(['corrective', 'preventive']).default('corrective'),
    equipment_id: zod_1.z.number().optional(),
    maintenance_team_id: zod_1.z.number().optional(),
    schedule_date: zod_1.z.string().optional(), // ISO datetime string
    duration: zod_1.z.number().optional(), // hours as float
    priority: zod_1.z.enum(['0', '1', '2', '3']).optional(),
    attachments: zod_1.z.array(helpdesk_1.attachmentSchema).max(3).optional(),
});
// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/equipment', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, equipment: [] });
        }
        const equipment = await client.searchRead(uid, 'maintenance.equipment', [], ['id', 'name', 'category_id']);
        res.json({ available: true, equipment: Array.isArray(equipment) ? equipment : [] });
    }
    catch (error) {
        console.error('Fetch Maintenance Equipment Error:', error);
        res.json({ available: false, equipment: [], message: error.message });
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
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, teams: [] });
        }
        const teams = await fetchMaintenanceTeams(client, uid);
        let employeeCompanyId = null;
        try {
            const employeeId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
            employeeCompanyId = await (0, odooCompatibility_1.getEmployeeCompanyId)(client, uid, employeeId);
        }
        catch (e) {
            console.warn('[maintenance] employee company lookup failed; returning unfiltered teams:', e);
        }
        const enriched = (0, odooCompatibility_1.withCompanyRequestability)(teams, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM);
        res.json({ available: true, teams: (0, odooCompatibility_1.requestableRecords)(enriched) });
    }
    catch (error) {
        console.error('Fetch Maintenance Teams Error:', error);
        res.json({ available: false, teams: [], message: error.message });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, categories: [] });
        }
        const categories = await client.searchRead(uid, 'maintenance.equipment.category', [], ['id', 'name']);
        res.json({ available: true, categories: Array.isArray(categories) ? categories : [] });
    }
    catch (error) {
        console.error('Fetch Maintenance Categories Error:', error);
        res.json({ available: false, categories: [], message: error.message });
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
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, requests: [] });
        }
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'maintenance.request');
        const customFieldNames = Object.keys(customFields);
        let requests = [];
        try {
            requests = await client.searchRead(uid, 'maintenance.request', [['employee_id', '=', parsedEmployeeId]], ['id', 'name', 'description', 'stage_id', 'category_id', 'maintenance_type', 'create_date', 'request_date', ...customFieldNames]);
        }
        catch {
            requests = await client.searchRead(uid, 'maintenance.request', [['employee_id', '=', parsedEmployeeId]], ['id', 'name', 'stage_id', 'category_id', 'maintenance_type', 'create_date', ...customFieldNames]);
        }
        const sorted = Array.isArray(requests)
            ? requests
                .sort((a, b) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
                .slice(0, 30)
            : [];
        res.json({ requests: sorted, custom_fields: customFields });
    }
    catch (error) {
        console.error('Fetch Maintenance Requests Error:', error);
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
        const body = { ...createMaintenanceSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, message: 'Maintenance module not available on this Odoo instance' });
        }
        const recordData = {
            name: body.name,
            employee_id: body.employee_id,
            maintenance_type: body.maintenance_type,
        };
        if (body.description)
            recordData.description = body.description;
        if (body.category_id)
            recordData.category_id = body.category_id;
        if (body.equipment_id)
            recordData.equipment_id = body.equipment_id;
        if (body.priority)
            recordData.priority = body.priority;
        let employeeCompanyId = null;
        try {
            employeeCompanyId = await (0, odooCompatibility_1.getEmployeeCompanyId)(client, uid, body.employee_id);
        }
        catch (e) {
            console.warn('[maintenance] employee company lookup failed; skipping team compatibility preflight:', e);
        }
        const teams = await fetchMaintenanceTeams(client, uid).catch(() => []);
        if (body.maintenance_team_id) {
            const selectedTeam = teams.find((team) => team.id === body.maintenance_team_id);
            if (selectedTeam && !(0, odooCompatibility_1.companyCompatible)(selectedTeam.company_id, employeeCompanyId)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
            recordData.maintenance_team_id = body.maintenance_team_id;
        }
        else if (teams.length > 0) {
            const compatibleTeams = (0, odooCompatibility_1.requestableRecords)((0, odooCompatibility_1.withCompanyRequestability)(teams, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM));
            if (compatibleTeams.length > 0) {
                recordData.maintenance_team_id = compatibleTeams[0].id;
            }
            else if (employeeCompanyId && teams.some((team) => 'company_id' in team)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
        }
        // schedule_date and duration — may not exist on older Odoo versions; retry without if rejected
        const extendedFields = {};
        if (body.schedule_date) {
            // Convert ISO string to Odoo datetime format 'YYYY-MM-DD HH:MM:SS'
            const d = new Date(body.schedule_date);
            extendedFields.schedule_date = d.toISOString().replace('T', ' ').substring(0, 19);
        }
        if (body.duration !== undefined)
            extendedFields.duration = body.duration;
        // Pre-validate base payload against live Odoo schema
        const maintenanceValidation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'maintenance.request', recordData);
        if (!maintenanceValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: maintenanceValidation.missing,
                invalid_values: maintenanceValidation.invalid,
            });
        }
        let newId;
        try {
            newId = await client.createRecord(uid, 'maintenance.request', { ...recordData, ...extendedFields });
        }
        catch (createErr) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes('schedule_date') || msg.includes('duration') || msg.includes('invalid field')) {
                console.warn('[maintenance] schedule_date/duration rejected, retrying without them:', msg);
                newId = await client.createRecord(uid, 'maintenance.request', recordData);
            }
            else if (msg.includes('incompatible companies') || msg.includes('company')) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
            else {
                throw createErr;
            }
        }
        if (body.attachments && body.attachments.length > 0) {
            await client.uploadAttachments(uid, body.attachments, 'maintenance.request', newId);
        }
        res.json({ status: 'success', id: newId });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Maintenance Request');
    }
});
exports.maintenanceRouter = router;
