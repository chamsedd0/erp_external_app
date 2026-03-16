import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';

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
// We detect the correct name once from the model schema and cache it.

let _leaveTypeField: string | null = null;

async function getLeaveTypeField(uid: number): Promise<string> {
    if (_leaveTypeField) return _leaveTypeField;

    try {
        const schema: any = await odooClient.getSchema(uid, 'hr.leave');

        // Priority list of known field names across Odoo versions
        const candidates = ['holiday_status_id', 'leave_type_id', 'time_off_type_id'];
        for (const name of candidates) {
            if (schema[name]) {
                _leaveTypeField = name;
                console.log(`[time_off] Detected leave type field: "${name}"`);
                return name;
            }
        }

        // Fallback: find any Many2one field whose name contains 'leave'/'holiday' + 'type'/'status'
        for (const [fieldName, def] of Object.entries(schema as Record<string, any>)) {
            if (
                def.type === 'many2one' &&
                (fieldName.includes('leave') || fieldName.includes('holiday')) &&
                (fieldName.includes('type') || fieldName.includes('status'))
            ) {
                _leaveTypeField = fieldName;
                console.log(`[time_off] Detected leave type field via schema scan: "${fieldName}"`);
                return fieldName;
            }
        }
    } catch (e) {
        console.warn('[time_off] Could not detect leave type field from schema:', e);
    }

    // Hard fallback — safe for most versions
    _leaveTypeField = 'holiday_status_id';
    console.warn(`[time_off] Leave type field detection failed, defaulting to "holiday_status_id"`);
    return _leaveTypeField;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET / - Fetch employee's time-off requests
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }

        const uid = await odooClient.authenticate();
        const leaveTypeField = await getLeaveTypeField(uid);

        const leaves: any = await odooClient.searchRead(
            uid,
            'hr.leave',
            [['employee_id', '=', parseInt(employeeId as string)]],
            ['id', 'name', leaveTypeField, 'date_from', 'date_to', 'number_of_days', 'state', 'create_date']
        );

        // Normalise: always expose the leave type under a stable key for the frontend
        const normalised = Array.isArray(leaves)
            ? leaves.map((l: any) => ({ ...l, leave_type_id: l[leaveTypeField] ?? null }))
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
        const uid = await odooClient.authenticate();
        const types: any = await odooClient.searchRead(
            uid,
            'hr.leave.type',
            [],
            ['id', 'name', 'requires_allocation', 'request_unit']
        );
        res.json({ types });
    } catch (error: any) {
        console.error('Fetch Leave Types Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create Time Off Request
router.post('/', async (req, res) => {
    try {
        const body = createLeaveSchema.parse(req.body);
        const uid = await odooClient.authenticate();
        const leaveTypeField = await getLeaveTypeField(uid);

        const formatDatetime = (isoString: string) => isoString.replace('T', ' ').substring(0, 19);

        const newLeaveId = await odooClient.createRecord(uid, 'hr.leave', {
            employee_id: body.employee_id,
            [leaveTypeField]: body.leave_type_id,   // use detected field name
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            name: body.name || 'Time Off Request from Portal',
            request_date_from: body.date_from.split('T')[0],
            request_date_to: body.date_to.split('T')[0],
        });

        if (body.attachments && body.attachments.length > 0) {
            try {
                await odooClient.uploadAttachments(uid, body.attachments, 'hr.leave', newLeaveId as number);
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
