import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient, OdooClientInstance } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';

const router = Router();

// Shared attachment schema
const attachmentSchema = z.object({
    name: z.string(),
    data: z.string(),     // base64
    mimetype: z.string(),
});

// Validation Schema for Time Off Request
// We accept the field as `leave_type_id` from the frontend regardless of what
// Odoo calls it internally — the actual Odoo field name is resolved at runtime below.
const createLeaveSchema = z.object({
    employee_id: z.number(),
    leave_type_id: z.number(), // Leave Type ID — frontend always sends this key
    date_from: z.string(),     // ISO String
    date_to: z.string(),       // ISO String
    name: z.string().optional(),
    attachments: z.array(attachmentSchema).max(3).optional(),
});

// ── Leave-type field detection ────────────────────────────────────────────────
// Odoo has renamed the leave type Many2one field across versions:
//   v14–v16  → holiday_status_id
//   v17+     → may be holiday_status_id, leave_type_id, or something else
// We detect the correct name once per tenant and cache it.

export const _leaveTypeField = new Map<string, string>();

export async function getLeaveTypeField(tenantId: string, client: OdooClientInstance, uid: number): Promise<string> {
    const cached = _leaveTypeField.get(tenantId);
    if (cached) return cached;

    const candidates = ['holiday_status_id', 'leave_type_id', 'time_off_type_id', 'work_entry_type_id'];
    for (const fieldName of candidates) {
        try {
            await client.searchRead(
                uid, 'hr.leave', [['state', '=', '__probe__']], [fieldName],
                true  // silent
            );
            _leaveTypeField.set(tenantId, fieldName);
            console.log(`[${tenantId}] [time_off] Detected leave type field: "${fieldName}"`);
            return fieldName;
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '');
            if (msg.includes('Invalid field') || msg.includes('KeyError') || msg.includes('ValueError')) {
                continue;
            }
            _leaveTypeField.set(tenantId, fieldName);
            console.log(`[${tenantId}] [time_off] Probe hit non-field error for "${fieldName}", using it: ${msg.substring(0, 80)}`);
            return fieldName;
        }
    }

    console.warn(`[${tenantId}] [time_off] All probes returned "Invalid field". Defaulting to "work_entry_type_id".`);
    _leaveTypeField.set(tenantId, 'work_entry_type_id');
    return 'work_entry_type_id';
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET / - Fetch employee's time-off requests
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
        let leaveTypeField = await getLeaveTypeField(tenantId, client, uid);

        const safeFields = [
            'id', 'name',
            'date_from', 'date_to',
            'request_date_from', 'request_date_to',
            'number_of_days', 'state', 'create_date', 'employee_id',
        ];
        const domain = [['employee_id', '=', parsedEmployeeId]];

        let leaves: any;
        try {
            leaves = await client.searchRead(
                uid, 'hr.leave', domain, [...safeFields, leaveTypeField]
            );
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '');
            if (msg.includes('Invalid field')) {
                console.warn(`[${tenantId}] [time_off] Field "${leaveTypeField}" rejected, resetting cache and retrying without it.`);
                _leaveTypeField.delete(tenantId);
                leaveTypeField = '';
                leaves = await client.searchRead(uid, 'hr.leave', domain, safeFields);
            } else {
                throw e;
            }
        }

        const normalised = Array.isArray(leaves)
            ? leaves.map((l: any) => ({
                ...l,
                leave_type_id: leaveTypeField ? (l[leaveTypeField] ?? null) : null,
            }))
            : leaves;

        res.json({ leaves: normalised });
    } catch (error: any) {
        console.error('Fetch Leaves Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /types - Fetch Leave Types
router.get('/types', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();

        try {
            const types: any = await client.searchRead(
                uid, 'hr.leave.type', [], ['id', 'name'], true
            );
            if (Array.isArray(types) && types.length > 0) {
                return res.json({ types });
            }
        } catch {
            // Fall through to Odoo 19+ approach
        }

        try {
            const allTypes: any = await client.searchRead(
                uid, 'hr.work.entry.type', [], ['id', 'name', 'code'], true
            );
            if (Array.isArray(allTypes)) {
                const seen = new Set<string>();
                const leaveTypes = allTypes
                    .filter((t: any) => typeof t.code === 'string' && t.code.startsWith('LEAVE'))
                    .map((t: any) => ({ id: t.id, name: t.name }))
                    .filter((t: any) => {
                        if (seen.has(t.name)) return false;
                        seen.add(t.name);
                        return true;
                    });
                return res.json({ types: leaveTypes });
            }
        } catch {
            // Fall through
        }

        res.json({ types: [], available: false });
    } catch (error: any) {
        res.json({ types: [], available: false });
    }
});

// GET /pending - Fetch pending time-off requests for the authenticated employee
router.get('/pending', async (req, res) => {
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
        const domain = [
            ['employee_id', '=', parsedEmployeeId],
            ['state', 'in', ['draft', 'confirm', 'validate1']],
        ];

        let leaves: any;
        try {
            leaves = await client.searchRead(
                uid, 'hr.leave', domain,
                ['id', 'name', 'date_from', 'date_to', 'number_of_days', 'state']
            );
        } catch {
            leaves = [];
        }

        res.json({ leaves: Array.isArray(leaves) ? leaves : [] });
    } catch (error: any) {
        console.error('Fetch Pending Leaves Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create Time Off Request
router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = createLeaveSchema.parse(req.body);
        const uid = await client.authenticate();
        const leaveTypeField = await getLeaveTypeField(tenantId, client, uid);

        const formatDatetime = (isoString: string) => isoString.replace('T', ' ').substring(0, 19);

        const leavePayload = (fieldName: string) => ({
            employee_id: body.employee_id,
            [fieldName]: body.leave_type_id,
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            name: body.name || 'Time Off Request from Portal',
            request_date_from: body.date_from.split('T')[0],
            request_date_to: body.date_to.split('T')[0],
        });

        let newLeaveId: any;
        try {
            newLeaveId = await client.createRecord(uid, 'hr.leave', leavePayload(leaveTypeField));
        } catch (createErr: any) {
            const msg = String(createErr?.faultString || createErr?.message || '');
            // If Odoo says KeyError: None, the leave type field name is wrong — reset cache and retry
            if (msg.includes('KeyError: None') && leaveTypeField !== 'holiday_status_id') {
                console.warn(`[${tenantId}] [time_off] Create failed with KeyError: None, retrying with holiday_status_id`);
                _leaveTypeField.set(tenantId, 'holiday_status_id');
                newLeaveId = await client.createRecord(uid, 'hr.leave', leavePayload('holiday_status_id'));
            } else {
                throw createErr;
            }
        }

        if (body.attachments && body.attachments.length > 0) {
            try {
                await client.uploadAttachments(uid, body.attachments, 'hr.leave', newLeaveId as number);
            } catch (attachError: any) {
                console.error('Leave attachment upload error:', attachError);
            }
        }

        res.json({ status: 'success', id: newLeaveId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Leave Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const timeOffRouter = router;
