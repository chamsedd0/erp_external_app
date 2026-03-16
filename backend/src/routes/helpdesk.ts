import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shared attachment schema — used by helpdesk and maintenance */
export const attachmentSchema = z.object({
    name: z.string(),
    data: z.string(),        // base64 encoded file content
    mimetype: z.string(),    // e.g. 'image/jpeg', 'application/pdf'
});

/**
 * Runtime check: verify the helpdesk.ticket model is accessible.
 * Returns false if the module is not installed (Community Edition or module not enabled).
 */
const isHelpdeskAvailable = async (uid: number): Promise<boolean> => {
    try {
        // silent=true: Odoo SaaS returns HTML (not an XML-RPC fault) when the module is missing,
        // which would otherwise flood the console with "Unknown XML-RPC tag 'TITLE'" errors.
        await odooClient.searchRead(uid, 'helpdesk.ticket', [['id', '=', 0]], ['id'], true);
        return true;
    } catch {
        return false;
    }
};

// ── Schema ────────────────────────────────────────────────────────────────────

const createHelpdeskSchema = z.object({
    employee_id: z.number(),
    name: z.string().min(1, 'Subject is required'),
    description: z.string().optional(),
    team_id: z.number().optional(),
    attachments: z.array(attachmentSchema).max(3).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /helpdesk/teams
 * Returns available helpdesk teams.
 * Returns { available: false } if helpdesk module is not installed.
 */
router.get('/teams', async (req, res) => {
    try {
        const uid = await odooClient.authenticate();

        if (!(await isHelpdeskAvailable(uid))) {
            return res.json({ available: false, teams: [] });
        }

        const teams: any = await odooClient.searchRead(
            uid,
            'helpdesk.team',
            [],
            ['id', 'name']
        );

        res.json({ available: true, teams: Array.isArray(teams) ? teams : [] });
    } catch (error: any) {
        console.error('Fetch Helpdesk Teams Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /helpdesk?employee_id=X
 * Returns IT support tickets submitted by this employee.
 * Returns { available: false } if helpdesk module is not installed.
 */
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }

        const uid = await odooClient.authenticate();

        if (!(await isHelpdeskAvailable(uid))) {
            return res.json({ available: false, tickets: [] });
        }

        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        // Get the employee's partner_id to filter tickets
        const employees: any = await odooClient.searchRead(
            uid,
            'hr.employee',
            [['id', '=', parsedEmployeeId]],
            ['id', 'name', 'user_id']
        );

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Filter tickets by employee using x_employee_id if available,
        // otherwise fall back to partner_id from user
        let domain: any[] = [];
        const employee = employees[0];

        if (employee.user_id && Array.isArray(employee.user_id)) {
            // Fetch partner_id from res.users
            const users: any = await odooClient.searchRead(
                uid,
                'res.users',
                [['id', '=', employee.user_id[0]]],
                ['id', 'partner_id']
            );
            if (Array.isArray(users) && users[0]?.partner_id) {
                domain = [['partner_id', '=', users[0].partner_id[0]]];
            }
        }

        // If we can't resolve a partner_id, return an empty list rather than
        // accidentally leaking every ticket in the company.
        if (domain.length === 0) {
            return res.json({ available: true, tickets: [] });
        }

        const tickets: any = await odooClient.searchRead(
            uid,
            'helpdesk.ticket',
            domain,
            ['id', 'name', 'description', 'stage_id', 'team_id', 'create_date', 'partner_id']
        );

        const sorted = Array.isArray(tickets)
            ? tickets
                .sort(
                    (a: any, b: any) =>
                        new Date(b.create_date).getTime() - new Date(a.create_date).getTime()
                )
                .slice(0, 30)
            : [];

        res.json({ available: true, tickets: sorted });
    } catch (error: any) {
        console.error('Fetch Helpdesk Tickets Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /helpdesk
 * Body: { employee_id, name, description?, team_id?, attachments? }
 * Creates a new helpdesk.ticket record.
 * Returns { available: false } if helpdesk module is not installed.
 */
router.post('/', async (req, res) => {
    try {
        const body = createHelpdeskSchema.parse(req.body);
        const uid = await odooClient.authenticate();

        if (!(await isHelpdeskAvailable(uid))) {
            return res.json({ available: false, message: 'Helpdesk module not available on this Odoo instance' });
        }

        // Resolve employee → partner_id (needed for helpdesk.ticket)
        const employees: any = await odooClient.searchRead(
            uid,
            'hr.employee',
            [['id', '=', body.employee_id]],
            ['id', 'name', 'user_id', 'work_email']
        );

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ error: 'Employee not found' });
        }

        const employee = employees[0];
        let partnerId: number | false = false;

        if (employee.user_id && Array.isArray(employee.user_id)) {
            const users: any = await odooClient.searchRead(
                uid,
                'res.users',
                [['id', '=', employee.user_id[0]]],
                ['id', 'partner_id']
            );
            if (Array.isArray(users) && users[0]?.partner_id) {
                partnerId = users[0].partner_id[0];
            }
        }

        const ticketData: Record<string, any> = {
            name: body.name,
            description: body.description || '',
        };

        if (partnerId) ticketData.partner_id = partnerId;
        if (body.team_id) ticketData.team_id = body.team_id;

        const newId = await odooClient.createRecord(uid, 'helpdesk.ticket', ticketData) as number;

        // Upload attachments if provided
        if (body.attachments && body.attachments.length > 0) {
            await odooClient.uploadAttachments(uid, body.attachments, 'helpdesk.ticket', newId);
        }

        res.json({ status: 'success', id: newId, available: true });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Helpdesk Ticket Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const helpdeskRouter = router;
