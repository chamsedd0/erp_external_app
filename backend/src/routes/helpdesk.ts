import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient, OdooClientInstance } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';

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
const isHelpdeskAvailable = async (client: OdooClientInstance, uid: number): Promise<boolean> => {
    try {
        await client.searchRead(uid, 'helpdesk.ticket', [['id', '=', 0]], ['id'], true);
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

router.get('/teams', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();

        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, teams: [] });
        }

        const teams: any = await client.searchRead(uid, 'helpdesk.team', [], ['id', 'name']);
        res.json({ available: true, teams: Array.isArray(teams) ? teams : [] });
    } catch (error: any) {
        console.error('Fetch Helpdesk Teams Error:', error);
        res.status(500).json({ error: error.message });
    }
});

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

        const uid = await client.authenticate();

        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, tickets: [] });
        }

        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        const employees: any = await client.searchRead(
            uid, 'hr.employee', [['id', '=', parsedEmployeeId]], ['id', 'name', 'user_id']
        );

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        let domain: any[] = [];
        const employee = employees[0];

        if (employee.user_id && Array.isArray(employee.user_id)) {
            const users: any = await client.searchRead(
                uid, 'res.users', [['id', '=', employee.user_id[0]]], ['id', 'partner_id']
            );
            if (Array.isArray(users) && users[0]?.partner_id) {
                domain = [['partner_id', '=', users[0].partner_id[0]]];
            }
        }

        if (domain.length === 0) {
            return res.json({ available: true, tickets: [] });
        }

        const tickets: any = await client.searchRead(
            uid, 'helpdesk.ticket', domain,
            ['id', 'name', 'description', 'stage_id', 'team_id', 'create_date', 'partner_id']
        );

        const sorted = Array.isArray(tickets)
            ? tickets
                .sort((a: any, b: any) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
                .slice(0, 30)
            : [];

        res.json({ available: true, tickets: sorted });
    } catch (error: any) {
        console.error('Fetch Helpdesk Tickets Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = createHelpdeskSchema.parse(req.body);
        const uid = await client.authenticate();

        if (!(await isHelpdeskAvailable(client, uid))) {
            return res.json({ available: false, message: 'Helpdesk module not available on this Odoo instance' });
        }

        const employees: any = await client.searchRead(
            uid, 'hr.employee', [['id', '=', body.employee_id]], ['id', 'name', 'user_id', 'work_email']
        );

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ error: 'Employee not found' });
        }

        const employee = employees[0];
        let partnerId: number | false = false;

        if (employee.user_id && Array.isArray(employee.user_id)) {
            const users: any = await client.searchRead(
                uid, 'res.users', [['id', '=', employee.user_id[0]]], ['id', 'partner_id']
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

        const newId = await client.createRecord(uid, 'helpdesk.ticket', ticketData) as number;

        if (body.attachments && body.attachments.length > 0) {
            await client.uploadAttachments(uid, body.attachments, 'helpdesk.ticket', newId);
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
