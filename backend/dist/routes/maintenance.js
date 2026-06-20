"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maintenanceRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const attachments_1 = require("../lib/attachments");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
const odooCompatibility_1 = require("../lib/odooCompatibility");
const INCOMPATIBLE_MAINTENANCE_EQUIPMENT = 'This equipment belongs to a different company than your employee profile.';
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
/**
 * Fetch maintenance teams scoped to a company. Returns `{ teams, hasCompanyField }`
 * — `hasCompanyField` is false only if every query failed to return `company_id`,
 * in which case callers must fail closed rather than assume the teams are global.
 */
async function fetchMaintenanceTeams(client, uid, context, companyId) {
    try {
        const teams = await client.searchRead(uid, 'maintenance.team', (0, odooCompatibility_1.companyDomain)(companyId), ['id', 'name', 'company_id'], { silent: true, context });
        return { teams: Array.isArray(teams) ? teams : [], hasCompanyField: true };
    }
    catch {
        // Keep company_id so company can still be verified; if the field itself is
        // unsupported, signal it so the caller fails closed.
        try {
            const teams = await client.searchRead(uid, 'maintenance.team', [], ['id', 'name', 'company_id'], { silent: true, context });
            return { teams: Array.isArray(teams) ? teams : [], hasCompanyField: true };
        }
        catch {
            const teams = await client.searchRead(uid, 'maintenance.team', [], ['id', 'name'], { silent: true, context }).catch(() => []);
            return { teams: Array.isArray(teams) ? teams : [], hasCompanyField: false };
        }
    }
}
// ── Schema ────────────────────────────────────────────────────────────────────
function formatOdooDatetime(value) {
    const d = new Date(value);
    return d.toISOString().replace('T', ' ').substring(0, 19);
}
const createMaintenanceSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    name: zod_1.z.string().min(1, 'Request title is required'),
    description: zod_1.z.string().optional(),
    category_id: zod_1.z.number().optional(),
    maintenance_type: zod_1.z.enum(['corrective', 'preventive']).default('corrective'),
    equipment_id: zod_1.z.number().optional(),
    maintenance_team_id: zod_1.z.number().optional(),
    schedule_date: zod_1.z.string().optional(), // ISO datetime string (preventive)
    schedule_end: zod_1.z.string().optional(), // ISO datetime string (preventive)
    request_date: zod_1.z.string().optional(), // date YYYY-MM-DD (corrective)
    recurring: zod_1.z.boolean().optional(), // preventive recurrence toggle
    production_id: zod_1.z.number().optional(), // mrp.production / Manufacturing Order
    duration: zod_1.z.number().optional(), // hours as float
    priority: zod_1.z.enum(['0', '1', '2', '3']).optional(),
    custom_values: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(), // tenant-specific x_ custom fields
    attachments: attachments_1.attachmentsSchema,
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const employeeCompanyId = ctx.company_id ?? null;
        // maintenance.equipment is per-company; scope with an explicit company
        // domain (context alone does not filter search_read). The fallback keeps
        // company_id so we never lose the ability to verify company; if even that
        // fails we return nothing rather than leak cross-company equipment.
        let equipmentHasCompanyField = true;
        let equipment = await client.searchRead(uid, 'maintenance.equipment', (0, odooCompatibility_1.companyDomain)(employeeCompanyId), ['id', 'name', 'category_id', 'company_id'], { silent: true, context: ctx }).catch(() => client.searchRead(uid, 'maintenance.equipment', [], ['id', 'name', 'category_id', 'company_id'], { silent: true, context: ctx })
            .catch(() => { equipmentHasCompanyField = false; return []; }));
        const list = Array.isArray(equipment) ? equipment : [];
        // Fail closed: keep only equipment we can confirm is the employee's company
        // (or genuinely global). A query that couldn't return company_id yields none.
        const companyScoped = list.filter((e) => (0, odooCompatibility_1.companyAllowedStrict)(e, employeeCompanyId, equipmentHasCompanyField));
        const scoped = (0, odooCompatibility_1.requestableRecords)((0, odooCompatibility_1.withCompanyRequestability)(companyScoped, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_EQUIPMENT));
        res.json({ available: true, equipment: scoped });
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const employeeCompanyId = ctx.company_id ?? null;
        const { teams, hasCompanyField } = await fetchMaintenanceTeams(client, uid, ctx, employeeCompanyId);
        // Fail closed: drop teams whose company we couldn't verify.
        const companyScoped = teams.filter((team) => (0, odooCompatibility_1.companyAllowedStrict)(team, employeeCompanyId, hasCompanyField));
        const enriched = (0, odooCompatibility_1.withCompanyRequestability)(companyScoped, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM);
        res.json({ available: true, teams: (0, odooCompatibility_1.requestableRecords)(enriched) });
    }
    catch (error) {
        console.error('Fetch Maintenance Teams Error:', error);
        res.json({ available: false, teams: [], message: error.message });
    }
});
router.get('/manufacturing-orders', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, orders: [] });
        }
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const employeeCompanyId = ctx.company_id ?? null;
        let orders = [];
        let mrpAvailable = true;
        try {
            orders = await client.searchRead(uid, 'mrp.production', [['state', 'not in', ['done', 'cancel']], ...(0, odooCompatibility_1.companyDomain)(employeeCompanyId)], ['id', 'name', 'company_id'], { silent: true, context: ctx, limit: 500 });
        }
        catch {
            mrpAvailable = false;
        }
        const list = Array.isArray(orders) ? orders : [];
        const scoped = (0, odooCompatibility_1.requestableRecords)((0, odooCompatibility_1.withCompanyRequestability)(list, employeeCompanyId, 'This manufacturing order belongs to a different company than your employee profile.'));
        res.json({ available: mrpAvailable, orders: mrpAvailable ? scoped : [] });
    }
    catch (error) {
        console.error('Fetch Maintenance Manufacturing Orders Error:', error);
        res.json({ available: false, orders: [], message: error.message });
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
        const ctx = await (0, authContext_1.buildReadContext)(req, client, uid);
        const categories = await client.searchRead(uid, 'maintenance.equipment.category', [], ['id', 'name'], { context: ctx });
        res.json({ available: true, categories: Array.isArray(categories) ? categories : [] });
    }
    catch (error) {
        console.error('Fetch Maintenance Categories Error:', error);
        res.json({ available: false, categories: [], message: error.message });
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
        res.json(await (0, schemaCache_1.getCustomFieldReport)(tenantId, client, uid, 'maintenance.request'));
    }
    catch (error) {
        console.error('Fetch Maintenance Form Schema Error:', error);
        res.json({ custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null });
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
            requests = await client.searchRead(uid, 'maintenance.request', [['employee_id', '=', parsedEmployeeId]], ['id', 'name', 'description', 'stage_id', 'category_id', 'equipment_id', 'maintenance_type', 'create_date', 'request_date', 'schedule_date', 'schedule_date_end', 'recurring_maintenance', 'production_id', 'duration', ...customFieldNames]);
        }
        catch {
            requests = await client.searchRead(uid, 'maintenance.request', [['employee_id', '=', parsedEmployeeId]], ['id', 'name', 'stage_id', 'category_id', 'equipment_id', 'maintenance_type', 'create_date', ...customFieldNames]);
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
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(recordData, body.custom_values);
        }
        // Enforce required custom fields up-front for a clear error message.
        const mntCustomFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'maintenance.request');
        const missingCustom = (0, schemaCache_1.validateRequiredCustomFields)(mntCustomFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }
        const ctx = await (0, authContext_1.buildOdooContext)(req, client, uid, body.employee_id);
        const filterCompanyId = ctx.company_id ?? null;
        // Pin the record to the employee's own company (defense-in-depth — never
        // let Odoo default it to the integration user's company).
        if (filterCompanyId)
            recordData.company_id = filterCompanyId;
        // Re-validate a client-supplied equipment_id against the employee company.
        // Fail closed: the record MUST be found and verifiably belong to the
        // employee's company (or be global). If the lookup errors, returns nothing,
        // or can't return company_id, reject — a crafted body must never slip an
        // unverified equipment_id through to Odoo.
        if (body.equipment_id) {
            let equipment = [];
            let lookupOk = true;
            try {
                const result = await client.searchRead(uid, 'maintenance.equipment', [['id', '=', body.equipment_id]], ['id', 'company_id'], { silent: true, context: ctx });
                equipment = Array.isArray(result) ? result : [];
            }
            catch {
                lookupOk = false;
            }
            if (!lookupOk || equipment.length === 0 ||
                !(0, odooCompatibility_1.companyAllowedStrict)(equipment[0], filterCompanyId, true)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_EQUIPMENT });
            }
        }
        const { teams, hasCompanyField: teamsHaveCompany } = await fetchMaintenanceTeams(client, uid, ctx, filterCompanyId)
            .catch(() => ({ teams: [], hasCompanyField: false }));
        if (body.maintenance_team_id) {
            // Fail closed: the supplied team must be present in the company-scoped
            // fetch AND verifiably belong to the employee's company. A crafted ID
            // that isn't in the verified list (or an unverifiable fallback) → 422.
            const selectedTeam = teams.find((team) => team.id === body.maintenance_team_id);
            if (!selectedTeam || !(0, odooCompatibility_1.companyAllowedStrict)(selectedTeam, filterCompanyId, teamsHaveCompany)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
            recordData.maintenance_team_id = body.maintenance_team_id;
        }
        else if (teams.length > 0) {
            // Auto-assign a default team — only from teams whose company we verified.
            const companyScoped = teams.filter((team) => (0, odooCompatibility_1.companyAllowedStrict)(team, filterCompanyId, teamsHaveCompany));
            const compatibleTeams = (0, odooCompatibility_1.requestableRecords)((0, odooCompatibility_1.withCompanyRequestability)(companyScoped, filterCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM));
            if (compatibleTeams.length > 0) {
                recordData.maintenance_team_id = compatibleTeams[0].id;
            }
            else if (filterCompanyId && teams.some((team) => 'company_id' in team)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
        }
        // Re-validate a client-supplied production_id. Fail closed: the MO must be
        // found and verifiably belong to the employee's company (or be global).
        if (body.production_id) {
            let orders = [];
            let lookupOk = true;
            try {
                const result = await client.searchRead(uid, 'mrp.production', [['id', '=', body.production_id]], ['id', 'company_id'], { silent: true, context: ctx });
                orders = Array.isArray(result) ? result : [];
            }
            catch {
                lookupOk = false;
            }
            if (!lookupOk || orders.length === 0 ||
                !(0, odooCompatibility_1.companyAllowedStrict)(orders[0], filterCompanyId, true)) {
                return res.status(422).json({
                    error: 'This manufacturing order belongs to a different company than your employee profile.',
                });
            }
        }
        const extendedFields = {};
        if (body.schedule_date) {
            extendedFields.schedule_date = formatOdooDatetime(body.schedule_date);
        }
        if (body.schedule_end && body.maintenance_type === 'preventive') {
            extendedFields.schedule_date_end = formatOdooDatetime(body.schedule_end);
        }
        if (body.recurring !== undefined && body.maintenance_type === 'preventive') {
            extendedFields.recurring_maintenance = body.recurring;
        }
        if (body.request_date)
            extendedFields.request_date = body.request_date.split('T')[0];
        if (body.production_id)
            extendedFields.production_id = body.production_id;
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
        // Human-readable labels for the optional fields, so the app can tell the
        // user exactly what didn't persist if an Odoo version rejects a field.
        const FIELD_LABELS = {
            schedule_date: 'Scheduled Date',
            schedule_date_end: 'Scheduled End',
            recurring_maintenance: 'Recurrent',
            request_date: 'Request Date',
            production_id: 'Manufacturing Order',
            duration: 'Duration',
        };
        // Create with all optional fields, then on an "invalid field" rejection
        // drop the offending field(s) one at a time and retry. Tracks exactly
        // which optional fields had to be dropped so we can report them.
        const droppedFields = [];
        let attemptFields = { ...extendedFields };
        let newId;
        // At most one retry per optional field, plus the initial attempt.
        for (let attempt = 0; attempt <= Object.keys(extendedFields).length; attempt++) {
            try {
                newId = await client.createRecord(uid, 'maintenance.request', { ...recordData, ...attemptFields }, ctx);
                break;
            }
            catch (createErr) {
                const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
                if (msg.includes('incompatible companies') || msg.includes('company')) {
                    return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
                }
                const remaining = Object.keys(attemptFields);
                // Identify a named field in the error, else (generic "invalid field")
                // drop the whole remaining optional set in one final retry.
                const named = remaining.find((field) => msg.includes(field.toLowerCase()));
                const toDrop = named ? [named] : (msg.includes('invalid field') ? remaining : []);
                if (toDrop.length === 0) {
                    throw createErr; // not an optional-field problem — surface it
                }
                console.warn(`[maintenance] optional field(s) rejected (${toDrop.join(', ')}), retrying without them:`, msg);
                for (const field of toDrop) {
                    delete attemptFields[field];
                    droppedFields.push(field);
                }
            }
        }
        if (newId === undefined) {
            // Exhausted retries without success — fall back to base payload once.
            newId = await client.createRecord(uid, 'maintenance.request', recordData, ctx);
        }
        let failedAttachments = [];
        if (body.attachments && body.attachments.length > 0) {
            const result = await client.uploadAttachments(uid, body.attachments, 'maintenance.request', newId, ctx);
            failedAttachments = result?.failed ?? [];
        }
        // Only report fields the user actually supplied (others were never sent).
        const droppedUserFields = droppedFields.filter((f) => f in extendedFields);
        const partial = failedAttachments.length > 0 || droppedUserFields.length > 0;
        res.json({
            status: 'success',
            id: newId,
            ...(partial ? { partial_success: true } : {}),
            ...(failedAttachments.length > 0 ? { failed_attachments: failedAttachments } : {}),
            ...(droppedUserFields.length > 0
                ? { dropped_fields: droppedUserFields.map((f) => FIELD_LABELS[f] ?? f) }
                : {}),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Maintenance Request');
    }
});
exports.maintenanceRouter = router;
