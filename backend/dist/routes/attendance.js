"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const attachments_1 = require("../lib/attachments");
const time_off_1 = require("./time_off");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
// NOTE: The mobile app uses the check-in/out CORRECTION flow only. The
// overtime (/attendance/overtime) and absence-justification
// (/attendance/justification) routes below are retained for API compatibility
// and other clients; the current mobile UI does not call them.
const router = (0, express_1.Router)();
// ── Helpers ───────────────────────────────────────────────────────────────────
function toOdooDatetime(iso) {
    return new Date(iso).toISOString().replace('T', ' ').substring(0, 19);
}
async function isOvertimeAvailable(client, uid) {
    try {
        await client.searchRead(uid, 'hr.attendance.overtime', [['id', '=', 0]], ['id'], true);
        return true;
    }
    catch {
        return false;
    }
}
// ── Schemas ───────────────────────────────────────────────────────────────────
const correctionSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    check_in: zod_1.z.string(), // ISO datetime
    check_out: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
    custom_values: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    attachments: attachments_1.attachmentsSchema,
});
const overtimeSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    date: zod_1.z.string(), // YYYY-MM-DD
    duration: zod_1.z.number().positive(),
    reason: zod_1.z.string().optional(),
    custom_values: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
const justificationSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    leave_type_id: zod_1.z.number(),
    date_from: zod_1.z.string(), // ISO date or datetime
    date_to: zod_1.z.string(),
    justification: zod_1.z.string().min(1, 'Justification text is required'),
    custom_values: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    attachments: attachments_1.attachmentsSchema,
});
// ── Routes ────────────────────────────────────────────────────────────────────
// GET /attendance — fetch recent attendance records for an employee
router.get('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const parsedId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.attendance');
        const customFieldNames = Object.keys(customFields);
        let records = [];
        try {
            const raw = await client.searchRead(uid, 'hr.attendance', [['employee_id', '=', parsedId]], ['id', 'employee_id', 'check_in', 'check_out', 'worked_hours', ...customFieldNames]);
            records = Array.isArray(raw) ? raw : [];
        }
        catch (e) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes('access denied') || msg.includes('no access')) {
                return res.json({ records: [], message: 'Attendance records not accessible — check Odoo access rights.' });
            }
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('object')) {
                return res.json({ records: [], available: false, message: 'Attendance module not available on this Odoo instance.' });
            }
            throw e;
        }
        const sorted = Array.isArray(records)
            ? records
                .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
                .slice(0, 30)
            : [];
        res.json({ records: sorted, custom_fields: customFields });
    }
    catch (error) {
        console.error('Fetch Attendance Records Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /attendance/overtime — fetch overtime records (Odoo 16+)
router.get('/overtime', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const parsedId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        if (!(await isOvertimeAvailable(client, uid))) {
            return res.json({ available: false, records: [], message: 'Overtime module requires Odoo 16+' });
        }
        let records;
        try {
            records = await client.searchRead(uid, 'hr.attendance.overtime', [['employee_id', '=', parsedId]], ['id', 'date', 'duration', 'state', 'create_date'], true);
        }
        catch {
            // 'state' doesn't exist on all Odoo versions — retry without it
            records = await client.searchRead(uid, 'hr.attendance.overtime', [['employee_id', '=', parsedId]], ['id', 'date', 'duration', 'create_date'], true);
        }
        const sorted = Array.isArray(records)
            ? records
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 30)
            : [];
        res.json({ available: true, records: sorted });
    }
    catch (error) {
        console.error('Fetch Overtime Records Error:', error);
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
        const empty = { custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null };
        const [correction, overtime, justification] = await Promise.all([
            (0, schemaCache_1.getCustomFieldReport)(tenantId, client, uid, 'hr.attendance').catch(() => empty),
            (0, schemaCache_1.getCustomFieldReport)(tenantId, client, uid, 'hr.attendance.overtime').catch(() => empty),
            (0, schemaCache_1.getCustomFieldReport)(tenantId, client, uid, 'hr.leave').catch(() => empty),
        ]);
        res.json({ correction, overtime, justification });
    }
    catch (error) {
        console.error('Fetch Attendance Form Schema Error:', error);
        const empty = { custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null };
        res.json({ correction: empty, overtime: empty, justification: empty });
    }
});
// POST /attendance/correction — create or correct an attendance check-in/out record
router.post('/correction', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const body = { ...correctionSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        const ctx = await (0, authContext_1.buildOdooContext)(req, client, uid, body.employee_id);
        const recordData = {
            employee_id: body.employee_id,
            check_in: toOdooDatetime(body.check_in),
        };
        if (body.check_out) {
            recordData.check_out = toOdooDatetime(body.check_out);
        }
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(recordData, body.custom_values);
        }
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.attendance');
        const missingCustom = (0, schemaCache_1.validateRequiredCustomFields)(customFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }
        // Pre-validate payload against live Odoo schema
        const correctionValidation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'hr.attendance', recordData);
        if (!correctionValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: correctionValidation.missing,
                invalid_values: correctionValidation.invalid,
            });
        }
        let newId;
        try {
            newId = await client.createRecord(uid, 'hr.attendance', recordData, ctx);
        }
        catch (createErr) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('object')) {
                return res.json({ available: false, message: 'Attendance module not available on this Odoo instance.' });
            }
            throw createErr;
        }
        // Attach reason as a message on the record chatter (best-effort, not all configs support it)
        if (body.reason) {
            try {
                await client.callMethod(uid, 'hr.attendance', 'message_post', [newId], {
                    body: `Correction reason: ${body.reason}`,
                    message_type: 'comment',
                }, ctx);
            }
            catch {
                // Chatter may not be accessible via XML-RPC — skip silently
            }
        }
        let failedAttachments = [];
        if (body.attachments && body.attachments.length > 0) {
            try {
                const result = await client.uploadAttachments(uid, body.attachments, 'hr.attendance', newId, ctx);
                failedAttachments = result?.failed ?? [];
            }
            catch (e) {
                console.error('Attendance attachment upload error:', e);
                failedAttachments = body.attachments.map(a => a.name);
            }
        }
        res.json({
            status: 'success',
            id: newId,
            ...(failedAttachments.length > 0 ? { partial_success: true, failed_attachments: failedAttachments } : {}),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Attendance Correction');
    }
});
// POST /attendance/overtime — request overtime (Odoo 16+)
router.post('/overtime', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const body = { ...overtimeSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        if (!(await isOvertimeAvailable(client, uid))) {
            return res.status(422).json({
                available: false,
                message: 'Overtime requests require Odoo 16+. This feature is not available on your Odoo instance.',
            });
        }
        const ctx = await (0, authContext_1.buildOdooContext)(req, client, uid, body.employee_id);
        // Probe which duration field name is used on this instance
        const recordData = {
            employee_id: body.employee_id,
            date: body.date,
        };
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(recordData, body.custom_values);
        }
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.attendance.overtime');
        const missingCustom = (0, schemaCache_1.validateRequiredCustomFields)(customFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }
        // Pre-validate base payload against live Odoo schema
        const overtimeValidation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'hr.attendance.overtime', recordData);
        if (!overtimeValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: overtimeValidation.missing,
                invalid_values: overtimeValidation.invalid,
            });
        }
        // Try 'duration' first; some versions use 'adjusted_cost' or similar
        let newId;
        try {
            newId = await client.createRecord(uid, 'hr.attendance.overtime', {
                ...recordData,
                duration: body.duration,
            }, ctx);
        }
        catch (err) {
            const msg = String(err?.faultString || err?.message || '').toLowerCase();
            if (msg.includes('duration') || msg.includes('invalid field')) {
                // Retry without duration — at minimum log the request
                console.warn('[attendance] overtime duration field rejected:', msg);
                newId = await client.createRecord(uid, 'hr.attendance.overtime', recordData, ctx);
            }
            else {
                throw err;
            }
        }
        // Post reason as a chatter message (best-effort)
        if (body.reason) {
            try {
                await client.callMethod(uid, 'hr.attendance.overtime', 'message_post', [newId], {
                    body: `Overtime reason: ${body.reason}`,
                    message_type: 'comment',
                }, ctx);
            }
            catch {
                // Skip silently
            }
        }
        res.json({ status: 'success', id: newId });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Overtime Request');
    }
});
// POST /attendance/justification — absence justification (creates hr.leave)
router.post('/justification', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const body = { ...justificationSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        const ctx = await (0, authContext_1.buildOdooContext)(req, client, uid, body.employee_id);
        // Detect the correct leave type field name for this Odoo version
        const leaveTypeField = await (0, time_off_1.getLeaveTypeField)(tenantId, client, uid);
        const formatDate = (iso) => iso.split('T')[0];
        const formatDatetime = (iso) => {
            const d = new Date(iso);
            return d.toISOString().replace('T', ' ').substring(0, 19);
        };
        const payload = {
            employee_id: body.employee_id,
            [leaveTypeField]: body.leave_type_id,
            name: body.justification,
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            request_date_from: formatDate(body.date_from),
            request_date_to: formatDate(body.date_to),
        };
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(payload, body.custom_values);
        }
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.leave');
        const missingCustom = (0, schemaCache_1.validateRequiredCustomFields)(customFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }
        // Pre-validate payload against live Odoo schema
        const justificationValidation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'hr.leave', payload);
        if (!justificationValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: justificationValidation.missing,
                invalid_values: justificationValidation.invalid,
            });
        }
        let newId;
        try {
            newId = await client.createRecord(uid, 'hr.leave', payload, ctx);
        }
        catch (err) {
            const msg = String(err?.faultString || err?.message || '').toLowerCase();
            if (msg.includes('keyerror') || msg.includes('invalid field')) {
                console.warn(`[attendance] justification: retrying with holiday_status_id after: ${msg}`);
                // Remove the version-detected field first, then set the legacy field
                // (guard handles the case where leaveTypeField is already holiday_status_id)
                delete payload[leaveTypeField];
                payload['holiday_status_id'] = body.leave_type_id;
                newId = await client.createRecord(uid, 'hr.leave', payload, ctx);
            }
            else {
                throw err;
            }
        }
        let failedAttachments = [];
        if (body.attachments && body.attachments.length > 0) {
            try {
                const result = await client.uploadAttachments(uid, body.attachments, 'hr.leave', newId, ctx);
                failedAttachments = result?.failed ?? [];
            }
            catch (e) {
                console.error('Justification attachment upload error:', e);
                failedAttachments = body.attachments.map(a => a.name);
            }
        }
        res.json({
            status: 'success',
            id: newId,
            ...(failedAttachments.length > 0 ? { partial_success: true, failed_attachments: failedAttachments } : {}),
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Absence Justification');
    }
});
exports.attendanceRouter = router;
