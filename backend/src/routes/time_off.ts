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

    // ── Probe-based detection ─────────────────────────────────────────────────
    // We use searchRead with a domain that will never match real records but looks
    // like a normal query (avoids SaaS trial controller interception).
    // Domain [['state','=','__probe__']] matches nothing but is a valid field query.
    //
    // KEY: we distinguish two error classes differently:
    //   • "Invalid field" / "KeyError" → field definitively does NOT exist → try next
    //   • Any other error (TITLE/HTML, etc.) → could be SaaS interception with a valid
    //     field; stop and use this candidate rather than falling back to a wrong default.
    const candidates = ['holiday_status_id', 'leave_type_id', 'time_off_type_id'];
    for (const fieldName of candidates) {
        try {
            await odooClient.searchRead(
                uid, 'hr.leave', [['state', '=', '__probe__']], [fieldName],
                true  // silent — suppress console.error for expected failures
            );
            // No error → field confirmed to exist
            _leaveTypeField = fieldName;
            console.log(`[time_off] Detected leave type field: "${fieldName}"`);
            return fieldName;
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '');
            if (msg.includes('Invalid field') || msg.includes('KeyError')) {
                // Field definitively doesn't exist on this Odoo version — try next
                continue;
            }
            // Any other error (TITLE/HTML, network, etc.): the SaaS controller may be
            // intercepting but the field likely exists. Use it and let the real query decide.
            _leaveTypeField = fieldName;
            console.log(`[time_off] Probe hit non-field error for "${fieldName}", using it: ${msg.substring(0, 80)}`);
            return fieldName;
        }
    }

    // All probes threw "Invalid field" — field name must be something else entirely.
    // Fall back to the legacy name; GET / will reset this if it's also wrong.
    console.warn('[time_off] All probes returned "Invalid field". Defaulting to "holiday_status_id".');
    _leaveTypeField = 'holiday_status_id';
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

        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        const uid = await odooClient.authenticate();
        let leaveTypeField = await getLeaveTypeField(uid);

        const safeFields = [
            'id', 'name',
            'date_from', 'date_to',
            'request_date_from', 'request_date_to',
            'number_of_days', 'state', 'create_date', 'employee_id',
        ];
        const domain = [['employee_id', '=', parsedEmployeeId]];

        let leaves: any;
        try {
            leaves = await odooClient.searchRead(
                uid, 'hr.leave', domain, [...safeFields, leaveTypeField]
            );
        } catch (e: any) {
            const msg = String(e?.faultString || e?.message || '');
            if (msg.includes('Invalid field')) {
                // The detected field name is wrong for this Odoo version.
                // Reset the cache so re-detection happens on the next request.
                console.warn(`[time_off] Field "${leaveTypeField}" rejected, resetting cache and retrying without it.`);
                _leaveTypeField = null;
                leaveTypeField = '';
                // Retry with only the safe fields — leave type will be null in response
                leaves = await odooClient.searchRead(uid, 'hr.leave', domain, safeFields);
            } else {
                throw e;
            }
        }

        // Normalise: always expose the leave type under a stable 'leave_type_id' key
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
        const uid = await odooClient.authenticate();
        // Only request id + name — other fields (requires_allocation, request_unit) were
        // renamed/restructured in Odoo 17+ and are not needed by the frontend anyway.
        // silent=true: prevent TITLE/HTML noise in console if module has issues
        const types: any = await odooClient.searchRead(
            uid,
            'hr.leave.type',
            [],
            ['id', 'name'],
            true
        );
        res.json({ types: Array.isArray(types) ? types : [] });
    } catch {
        // hr.leave.type may not be accessible (module issue, SaaS restriction, etc.)
        // Return empty list so the frontend can still render the form
        res.json({ types: [], available: false });
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
