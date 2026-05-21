import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient, OdooClientInstance } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { attachmentSchema } from './helpdesk';
import { getCustomFields, validatePayload } from '../lib/schemaCache';
import { sendOdooError } from '../odoo/parseError';
import { getAuthenticatedEmployeeId } from '../lib/authContext';
import { companyCompatible, getEmployeeCompanyId, requestableRecords, withCompanyRequestability } from '../lib/odooCompatibility';

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
const INCOMPATIBLE_MAINTENANCE_TEAM = 'No maintenance team is available for your employee company. Please contact your administrator.';

async function fetchMaintenanceTeams(client: OdooClientInstance, uid: number): Promise<any[]> {
    try {
        const teams: any = await client.searchRead(
            uid, 'maintenance.team', [], ['id', 'name', 'company_id'], true
        );
        return Array.isArray(teams) ? teams : [];
    } catch {
        const teams: any = await client.searchRead(
            uid, 'maintenance.team', [], ['id', 'name']
        );
        return Array.isArray(teams) ? teams : [];
    }
}

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

        const teams = await fetchMaintenanceTeams(client, uid);
        let employeeCompanyId: number | null = null;
        try {
            const employeeId = getAuthenticatedEmployeeId(req, req.query.employee_id);
            employeeCompanyId = await getEmployeeCompanyId(client, uid, employeeId);
        } catch (e) {
            console.warn('[maintenance] employee company lookup failed; returning unfiltered teams:', e);
        }
        const enriched = withCompanyRequestability(teams, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM);
        res.json({ available: true, teams: requestableRecords(enriched) });
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

        const parsedEmployeeId = getAuthenticatedEmployeeId(req, req.query.employee_id);

        const uid = await client.authenticate();

        if (!(await isMaintenanceAvailable(client, uid))) {
            return res.json({ available: false, requests: [] });
        }

        const customFields = await getCustomFields(tenantId, client, uid, 'maintenance.request');
        const customFieldNames = Object.keys(customFields);

        let requests: any = [];
        try {
            requests = await client.searchRead(
                uid, 'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'description', 'stage_id', 'category_id', 'maintenance_type', 'create_date', 'request_date', ...customFieldNames]
            );
        } catch {
            requests = await client.searchRead(
                uid, 'maintenance.request',
                [['employee_id', '=', parsedEmployeeId]],
                ['id', 'name', 'stage_id', 'category_id', 'maintenance_type', 'create_date', ...customFieldNames]
            );
        }

        const sorted = Array.isArray(requests)
            ? requests
                .sort((a: any, b: any) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
                .slice(0, 30)
            : [];

        res.json({ requests: sorted, custom_fields: customFields });
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

        const body = { ...createMaintenanceSchema.parse(req.body), employee_id: getAuthenticatedEmployeeId(req, req.body?.employee_id) };
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
        if (body.priority) recordData.priority = body.priority;

        let employeeCompanyId: number | null = null;
        try {
            employeeCompanyId = await getEmployeeCompanyId(client, uid, body.employee_id);
        } catch (e) {
            console.warn('[maintenance] employee company lookup failed; skipping team compatibility preflight:', e);
        }

        const teams = await fetchMaintenanceTeams(client, uid).catch(() => []);
        if (body.maintenance_team_id) {
            const selectedTeam = teams.find((team: any) => team.id === body.maintenance_team_id);
            if (selectedTeam && !companyCompatible(selectedTeam.company_id, employeeCompanyId)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
            recordData.maintenance_team_id = body.maintenance_team_id;
        } else if (teams.length > 0) {
            const compatibleTeams = requestableRecords(
                withCompanyRequestability(teams, employeeCompanyId, INCOMPATIBLE_MAINTENANCE_TEAM)
            );
            if (compatibleTeams.length > 0) {
                recordData.maintenance_team_id = compatibleTeams[0].id;
            } else if (employeeCompanyId && teams.some((team: any) => 'company_id' in team)) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
            }
        }

        // schedule_date and duration — may not exist on older Odoo versions; retry without if rejected
        const extendedFields: Record<string, any> = {};
        if (body.schedule_date) {
            // Convert ISO string to Odoo datetime format 'YYYY-MM-DD HH:MM:SS'
            const d = new Date(body.schedule_date);
            extendedFields.schedule_date = d.toISOString().replace('T', ' ').substring(0, 19);
        }
        if (body.duration !== undefined) extendedFields.duration = body.duration;

        // Pre-validate base payload against live Odoo schema
        const maintenanceValidation = await validatePayload(tenantId, client, uid, 'maintenance.request', recordData);
        if (!maintenanceValidation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: maintenanceValidation.missing,
                invalid_values: maintenanceValidation.invalid,
            });
        }

        let newId: number;
        try {
            newId = await client.createRecord(uid, 'maintenance.request', { ...recordData, ...extendedFields }) as number;
        } catch (createErr: any) {
            const msg = String(createErr?.faultString || createErr?.message || '').toLowerCase();
            if (msg.includes('schedule_date') || msg.includes('duration') || msg.includes('invalid field')) {
                console.warn('[maintenance] schedule_date/duration rejected, retrying without them:', msg);
                newId = await client.createRecord(uid, 'maintenance.request', recordData) as number;
            } else if (msg.includes('incompatible companies') || msg.includes('company')) {
                return res.status(422).json({ error: INCOMPATIBLE_MAINTENANCE_TEAM });
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
        return sendOdooError(res, error, 'Create Maintenance Request');
    }
});

export const maintenanceRouter = router;
