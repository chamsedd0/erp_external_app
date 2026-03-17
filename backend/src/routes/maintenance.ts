import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';
import { attachmentSchema } from './helpdesk';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Runtime check: verify the maintenance.request model is accessible.
 * Returns false if the module is not installed or returns an HTML response
 * (which happens on Odoo SaaS trial when the Maintenance module isn't enabled).
 */
const isMaintenanceAvailable = async (uid: number): Promise<boolean> => {
    try {
        await odooClient.searchRead(uid, 'maintenance.request', [['id', '=', 0]], ['id'], true);
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
    attachments: z.array(attachmentSchema).max(3).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /maintenance/categories
 * Returns all maintenance equipment categories.
 */
router.get('/categories', async (req, res) => {
    try {
        const uid = await odooClient.authenticate();

        if (!(await isMaintenanceAvailable(uid))) {
            return res.json({ available: false, categories: [] });
        }

        const categories: any = await odooClient.searchRead(
            uid,
            'maintenance.equipment.category',
            [],
            ['id', 'name']
        );
        res.json({ available: true, categories: Array.isArray(categories) ? categories : [] });
    } catch (error: any) {
        console.error('Fetch Maintenance Categories Error:', error);
        res.json({ available: false, categories: [], message: error.message });
    }
});

/**
 * GET /maintenance?employee_id=X
 * Returns all maintenance requests submitted by the employee.
 * NOTE: maintenance.request uses stage_id (not a string 'state').
 */
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

        if (!(await isMaintenanceAvailable(uid))) {
            return res.json({ available: false, requests: [] });
        }

        // Fetch with full field list first; fall back to safe minimal fields if any field is rejected
        let requests: any = [];
        try {
            requests = await odooClient.searchRead(
                uid,
                'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'description', 'stage_id', 'category_id', 'maintenance_type', 'create_date', 'request_date']
            );
        } catch {
            // One of the optional fields may not exist — retry with safe-only fields
            requests = await odooClient.searchRead(
                uid,
                'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'stage_id', 'category_id', 'maintenance_type', 'create_date']
            );
        }

        const sorted = Array.isArray(requests)
            ? requests
                .sort(
                    (a: any, b: any) =>
                        new Date(b.create_date).getTime() - new Date(a.create_date).getTime()
                )
                .slice(0, 30)
            : [];

        res.json({ requests: sorted });
    } catch (error: any) {
        console.error('Fetch Maintenance Requests Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /maintenance
 * Body: { employee_id, name, description?, category_id?, maintenance_type, attachments? }
 * Creates a new maintenance.request record.
 */
router.post('/', async (req, res) => {
    try {
        const body = createMaintenanceSchema.parse(req.body);
        const uid = await odooClient.authenticate();

        if (!(await isMaintenanceAvailable(uid))) {
            return res.json({ available: false, message: 'Maintenance module not available on this Odoo instance' });
        }

        // Core fields (stable across all Odoo versions with maintenance module)
        const recordData: Record<string, any> = {
            name: body.name,
            employee_id: body.employee_id,
            maintenance_type: body.maintenance_type,
        };

        // description: HTML text field — only include if provided to avoid empty-value issues
        if (body.description) {
            recordData.description = body.description;
        }

        if (body.category_id) {
            recordData.category_id = body.category_id;
        }

        const newId = await odooClient.createRecord(uid, 'maintenance.request', recordData) as number;

        // Upload attachments if provided
        if (body.attachments && body.attachments.length > 0) {
            await odooClient.uploadAttachments(uid, body.attachments, 'maintenance.request', newId);
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
