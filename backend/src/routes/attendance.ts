import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { attachmentSchema } from './helpdesk';
import { getLeaveTypeField } from './time_off';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function toOdooDatetime(iso: string): string {
    return new Date(iso).toISOString().replace('T', ' ').substring(0, 19);
}

async function isOvertimeAvailable(client: any, uid: number): Promise<boolean> {
    try {
        await client.searchRead(uid, 'hr.attendance.overtime', [['id', '=', 0]], ['id'], true);
        return true;
    } catch {
        return false;
    }
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const correctionSchema = z.object({
    employee_id: z.number(),
    check_in: z.string(),          // ISO datetime
    check_out: z.string().optional(),
    reason: z.string().optional(),
    attachments: z.array(attachmentSchema).max(3).optional(),
});

const overtimeSchema = z.object({
    employee_id: z.number(),
    date: z.string(),              // YYYY-MM-DD
    duration: z.number().positive(),
    reason: z.string().optional(),
});

const justificationSchema = z.object({
    employee_id: z.number(),
    leave_type_id: z.number(),
    date_from: z.string(),         // ISO date or datetime
    date_to: z.string(),
    justification: z.string().min(1, 'Justification text is required'),
    attachments: z.array(attachmentSchema).max(3).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /attendance — fetch recent attendance records for an employee
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const employeeId = req.query.employee_id;
        if (!employeeId) return res.status(400).json({ error: 'employee_id query parameter required' });
        const parsedId = parseInt(employeeId as string);
        if (isNaN(parsedId)) return res.status(400).json({ error: 'Invalid employee_id' });

        const uid = await client.authenticate();

        let records: any[] = [];
        try {
            const raw = await client.searchRead(
                uid, 'hr.attendance',
                [['employee_id', '=', parsedId]],
                ['id', 'employee_id', 'check_in', 'check_out', 'worked_hours']
            );
            records = Array.isArray(raw) ? raw : [];
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '').toLowerCase();
            if (msg.includes('access denied') || msg.includes('no access')) {
                return res.json({ records: [], message: 'Attendance records not accessible — check Odoo access rights.' });
            }
            throw e;
        }

        const sorted = Array.isArray(records)
            ? records
                .sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
                .slice(0, 30)
            : [];

        res.json({ records: sorted });
    } catch (error: any) {
        console.error('Fetch Attendance Records Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /attendance/overtime — fetch overtime records (Odoo 16+)
router.get('/overtime', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const employeeId = req.query.employee_id;
        if (!employeeId) return res.status(400).json({ error: 'employee_id query parameter required' });
        const parsedId = parseInt(employeeId as string);
        if (isNaN(parsedId)) return res.status(400).json({ error: 'Invalid employee_id' });

        const uid = await client.authenticate();

        if (!(await isOvertimeAvailable(client, uid))) {
            return res.json({ available: false, records: [], message: 'Overtime module requires Odoo 16+' });
        }

        const records: any = await client.searchRead(
            uid, 'hr.attendance.overtime',
            [['employee_id', '=', parsedId]],
            ['id', 'date', 'duration', 'state', 'create_date'],
            true
        );

        const sorted = Array.isArray(records)
            ? records
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 30)
            : [];

        res.json({ available: true, records: sorted });
    } catch (error: any) {
        console.error('Fetch Overtime Records Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /attendance/correction — create or correct an attendance check-in/out record
router.post('/correction', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = correctionSchema.parse(req.body);
        const uid = await client.authenticate();

        const recordData: Record<string, any> = {
            employee_id: body.employee_id,
            check_in: toOdooDatetime(body.check_in),
        };

        if (body.check_out) {
            recordData.check_out = toOdooDatetime(body.check_out);
        }

        const newId = await client.createRecord(uid, 'hr.attendance', recordData) as number;

        // Attach reason as a message on the record chatter (best-effort, not all configs support it)
        if (body.reason) {
            try {
                await client.callMethod(uid, 'hr.attendance', 'message_post', [newId], {
                    body: `Correction reason: ${body.reason}`,
                    message_type: 'comment',
                });
            } catch {
                // Chatter may not be accessible via XML-RPC — skip silently
            }
        }

        if (body.attachments && body.attachments.length > 0) {
            try {
                await client.uploadAttachments(uid, body.attachments, 'hr.attendance', newId);
            } catch (e: any) {
                console.error('Attendance attachment upload error:', e);
            }
        }

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Attendance Correction Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /attendance/overtime — request overtime (Odoo 16+)
router.post('/overtime', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = overtimeSchema.parse(req.body);
        const uid = await client.authenticate();

        if (!(await isOvertimeAvailable(client, uid))) {
            return res.status(422).json({
                available: false,
                message: 'Overtime requests require Odoo 16+. This feature is not available on your Odoo instance.',
            });
        }

        // Probe which duration field name is used on this instance
        const recordData: Record<string, any> = {
            employee_id: body.employee_id,
            date: body.date,
        };

        // Try 'duration' first; some versions use 'adjusted_cost' or similar
        let newId: number;
        try {
            newId = await client.createRecord(uid, 'hr.attendance.overtime', {
                ...recordData,
                duration: body.duration,
            }) as number;
        } catch (err: any) {
            const msg = String(err?.faultString || err?.message || '').toLowerCase();
            if (msg.includes('duration') || msg.includes('invalid field')) {
                // Retry without duration — at minimum log the request
                console.warn('[attendance] overtime duration field rejected:', msg);
                newId = await client.createRecord(uid, 'hr.attendance.overtime', recordData) as number;
            } else {
                throw err;
            }
        }

        // Post reason as a chatter message (best-effort)
        if (body.reason) {
            try {
                await client.callMethod(uid, 'hr.attendance.overtime', 'message_post', [newId], {
                    body: `Overtime reason: ${body.reason}`,
                    message_type: 'comment',
                });
            } catch {
                // Skip silently
            }
        }

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Overtime Request Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /attendance/justification — absence justification (creates hr.leave)
router.post('/justification', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = justificationSchema.parse(req.body);
        const uid = await client.authenticate();

        // Detect the correct leave type field name for this Odoo version
        const leaveTypeField = await getLeaveTypeField(tenantId, client, uid);

        const formatDate = (iso: string): string => iso.split('T')[0];
        const formatDatetime = (iso: string): string => {
            const d = new Date(iso);
            return d.toISOString().replace('T', ' ').substring(0, 19);
        };

        const payload: Record<string, any> = {
            employee_id: body.employee_id,
            [leaveTypeField]: body.leave_type_id,
            name: body.justification,
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            request_date_from: formatDate(body.date_from),
            request_date_to: formatDate(body.date_to),
        };

        let newId: number;
        try {
            newId = await client.createRecord(uid, 'hr.leave', payload) as number;
        } catch (err: any) {
            const msg = String(err?.faultString || err?.message || '').toLowerCase();
            if (msg.includes('keyerror') || msg.includes('invalid field')) {
                console.warn(`[attendance] justification: retrying with holiday_status_id after: ${msg}`);
                payload['holiday_status_id'] = body.leave_type_id;
                delete payload[leaveTypeField];
                newId = await client.createRecord(uid, 'hr.leave', payload) as number;
            } else {
                throw err;
            }
        }

        if (body.attachments && body.attachments.length > 0) {
            try {
                await client.uploadAttachments(uid, body.attachments, 'hr.leave', newId);
            } catch (e: any) {
                console.error('Justification attachment upload error:', e);
            }
        }

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Absence Justification Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const attendanceRouter = router;
