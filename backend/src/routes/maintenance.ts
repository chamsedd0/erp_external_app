import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient, OdooClientInstance } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { attachmentSchema } from './helpdesk';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const isMaintenanceAvailable = async (client: OdooClientInstance, uid: number): Promise<boolean> => {
    try {
        await client.searchRead(uid, 'maintenance.request', [['id', '=', 0]], ['id'], true);
        return true;
    } catch {
        return false;
    }
};

// ── Schema ────────────────────────────────────────────────────────────────────

const createMaintenanceSchema = z.object({
    employee_id: z.number(),
    name: z.string().min(1, 'Request title is required'),
    description: z.string().optional(),
    category_id: z.number().optional(),
    maintenance_type: z.enum(['corrective', 'preventive']).default('corrective'),
    equipment_id: z.number().optional(),
    maintenance_team_id: z.number().optional(),
    schedule_date: z.string().optional(), // ISO datetime string
    duration: z.number().optional(),      // hours as float
    priority: z.enum(['0', '1', '2', '3']).optional(),
    attachments: z.array(attachmentSchema).max(3).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/equipment', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, equipment: [] });
        }

        const equipment: any = await client.searchRead(
            uid, 'maintenance.equipment', [], ['id', 'name', 'category_id']
        );
        res.json({ available: true, equipment: Array.isArray(equipment) ? equipment : [] });
    } catch (error: any) {
        console.error('Fetch Maintenance Equipment Error:', error);
        res.json({ available: false, equipment: [], message: error.message });
    }
});

router.get('/teams', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, teams: [] });
        }

        const teams: any = await client.searchRead(
            uid, 'maintenance.team', [], ['id', 'name']
        );
        res.json({ available: true, teams: Array.isArray(teams) ? teams : [] });
    } catch (error: any) {
        console.error('Fetch Maintenance Teams Error:', error);
        res.json({ available: false, teams: [], message: error.message });
    }
});

router.get('/categories', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, categories: [] });
        }

        const categories: any = await client.searchRead(
            uid, 'maintenance.equipment.category', [], ['id', 'name']
        );
        res.json({ available: true, categories: Array.isArray(categories) ? categories : [] });
    } catch (error: any) {
        console.error('Fetch Maintenance Categories Error:', error);
        res.json({ available: false, categories: [], message: error.message });
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
        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, requests: [] });
        }

        let requests: any = [];
        try {
            requests = await client.searchRead(
                uid, 'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'description', 'stage_id', 'category_id', 'maintenance_type', 'create_date', 'request_date']
            );
        } catch {
            requests = await client.searchRead(
                uid, 'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'stage_id', 'category_id', 'maintenance_type', 'create_date']
            );
        }

        const sorted = Array.isArray(requests)
            ? requests
                .sort((a: any, b: any) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
                .slice(0, 30)
            : [];

        res.json({ requests: sorted });
    } catch (error: any) {
        console.error('Fetch Maintenance Requests Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = createMaintenanceSchema.parse(req.body);
        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, message: 'Maintenance module not available on this Odoo instance' });
        }

        const recordData: Record<string, any> = {
            name: body.name,
            employee_id: body.employee_id,
            maintenance_type: body.maintenance_type,
        };

        if (body.description) recordData.description = body.description;
        if (body.category_id) recordData.category_id = body.category_id;
        if (body.equipment_id) recordData.equipment_id = body.equipment_id;
        if (body.maintenance_team_id) recordData.maintenance_team_id = body.maintenance_team_id;
        if (body.priority) recordData.priority = body.priority;

        // schedule_date and duration — may not exist on older Odoo versions; retry without if rejected
        const extendedFields: Record<string, any> = {};
        if (body.schedule_date) {
            // Convert ISO string to Odoo datetime format 'YYYY-MM-DD HH:MM:SS'
            const d = new Date(body.schedule_date);
            extendedFields.schedule_date = d.toISOString().replace('T', ' ').substring(0, 19);
        }
        if (body.duration !== undefined) extendedFields.duration = body.duration;

        let newId: number;
        try {
            newId = await client.createRecord(uid, 'maintenance.request', { ...recordData, ...extendedFields }) as number;
        } catch (createErr: any) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes('schedule_date') || msg.includes('duration') || msg.includes('invalid field')) {
                console.warn('[maintenance] schedule_date/duration rejected, retrying without them:', msg);
                newId = await client.createRecord(uid, 'maintenance.request', recordData) as number;
            } else if (msg.includes('incompatible companies') || msg.includes('company')) {
                return res.status(400).json({ error: 'Incompatible companies: the employee belongs to a different company than the maintenance team. Please contact your administrator.' });
            } else {
                throw createErr;
            }
        }

        if (body.attachments && body.attachments.length > 0) {
            await client.uploadAttachments(uid, body.attachments, 'maintenance.request', newId);
        }

        res.json({ status: 'success', id: newId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Maintenance Request Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const maintenanceRouter = router;
