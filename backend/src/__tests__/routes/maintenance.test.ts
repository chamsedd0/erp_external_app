import request from 'supertest';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { getOdooClient } from '../../odoo/client';
import { authHeader, SAMPLE_TENANT, makeMockOdooClient, mockSearchReadByModel } from './helpers';

jest.mock('../../lib/tenantStore');
jest.mock('../../odoo/client');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;

let mockClient: ReturnType<typeof makeMockOdooClient>;

beforeEach(() => {
    jest.clearAllMocks();
    mockClient = makeMockOdooClient();
    mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
    mockGetOdooClient.mockReturnValue(mockClient as any);
});

// isMaintenanceAvailable calls searchRead on 'maintenance.request'.
// Resolves → available. Throws → unavailable.

// ─── GET /maintenance/categories ──────────────────────────────────────────────

describe('GET /maintenance/categories', () => {
    it('returns categories when maintenance module is available', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe → available
            'maintenance.equipment.category': () => [
                { id: 1, name: 'HVAC' },
                { id: 2, name: 'Electrical' },
            ],
        });

        const res = await request(app)
            .get('/maintenance/categories')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.categories).toHaveLength(2);
    });

    it('returns available:false when maintenance module is not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('model not found'));

        const res = await request(app)
            .get('/maintenance/categories')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.categories).toEqual([]);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/maintenance/categories');
        expect(res.status).toBe(401);
    });

    it('returns 401 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/maintenance/categories')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });
});

// ─── GET /maintenance ──────────────────────────────────────────────────────────

describe('GET /maintenance', () => {
    it('returns requests sorted by create_date descending', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([]) // availability probe
            .mockResolvedValueOnce([   // maintenance.request
                { id: 10, name: 'Fix AC', stage_id: [1, 'New'], create_date: '2025-01-05 09:00:00' },
                { id: 11, name: 'Fix lights', stage_id: [1, 'New'], create_date: '2025-01-10 09:00:00' },
            ]);

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.requests[0].id).toBe(11); // newer first
        expect(res.body.requests[1].id).toBe(10);
    });

    it('falls back to simpler field set when request_date field is absent', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // availability probe
            .mockRejectedValueOnce(new Error('field request_date not found')) // full fields fail
            .mockResolvedValueOnce([{ id: 20, name: 'Broken door', create_date: '2025-02-01 08:00:00' }]); // fallback

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.requests).toHaveLength(1);
    });

    it('returns available:false when maintenance module unavailable', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('module not installed'));

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.requests).toEqual([]);
    });

    it('derives employee_id from JWT when query parameter is missing', async () => {
        const res = await request(app)
            .get('/maintenance')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/maintenance?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('caps results at 30', async () => {
        const manyRequests = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: `Request ${i + 1}`,
            create_date: `2025-01-${String(i + 1).padStart(2, '0')} 00:00:00`,
        }));

        mockClient.searchRead
            .mockResolvedValueOnce([])  // probe
            .mockResolvedValueOnce(manyRequests);

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.body.requests).toHaveLength(30);
    });
});

// ─── POST /maintenance ─────────────────────────────────────────────────────────

describe('POST /maintenance', () => {
    const VALID_BODY = {
        employee_id: 42,
        name: 'Fix the printer on 3rd floor',
        description: 'Paper jam every morning',
        maintenance_type: 'corrective',
        category_id: 1,
    };

    function setupAvailable() {
        mockClient.searchRead.mockResolvedValueOnce([]); // availability probe
    }

    it('creates request and returns 200 with id', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(55);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(55);
        expect(res.body.status).toBe('success');
    });

    it('defaults maintenance_type to corrective when not provided', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(56);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ employee_id: 42, name: 'Fix something' });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.maintenance_type).toBe('corrective');
    });

    it('includes category_id and description when provided', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(57);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.category_id).toBe(1);
        expect(createArgs.description).toBe('Paper jam every morning');
    });

    it('omits category_id and description when not provided', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(58);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ employee_id: 42, name: 'Fix thing' });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('category_id');
        expect(createArgs).not.toHaveProperty('description');
    });

    it('returns available:false when module not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('not installed'));

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ employee_id: 42 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when maintenance_type is invalid', async () => {
        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, maintenance_type: 'invalid_type' });
        expect(res.status).toBe(400);
    });

    it('calls uploadAttachments when attachments provided', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(60);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'photo.jpg', data: 'base64==', mimetype: 'image/jpeg' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(
            1, expect.any(Array), 'maintenance.request', 60, expect.any(Object)
        );
    });

    it('returns 500 when createRecord throws', async () => {
        setupAvailable();
        mockClient.createRecord.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });

    it('passes equipment_id, maintenance_team_id and priority when provided', async () => {
        // The create verifies the supplied equipment_id and team_id against the
        // employee company before accepting them — both resolve to company 1 here.
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe
            'maintenance.equipment': () => [{ id: 5, company_id: [1, 'My Company'] }],
            'maintenance.team': () => [{ id: 2, name: 'My Team', company_id: [1, 'My Company'] }],
        }, { employeeCompanyId: 1 });
        mockClient.createRecord.mockResolvedValueOnce(61);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, equipment_id: 5, maintenance_team_id: 2, priority: '2' });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.equipment_id).toBe(5);
        expect(createArgs.maintenance_team_id).toBe(2);
        expect(createArgs.priority).toBe('2');
    });

    it('selects a compatible maintenance team when body omits one', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([
                { id: 7, name: 'Compatible', company_id: [1, 'My Company'] },
                { id: 8, name: 'Other', company_id: [2, 'Other'] },
            ]);
        mockClient.createRecord.mockResolvedValueOnce(63);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(mockClient.createRecord.mock.calls[0][2].maintenance_team_id).toBe(7);
    });

    it('returns 422 when selected maintenance team belongs to another company', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 2, name: 'Other', company_id: [2, 'Other'] }]);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, maintenance_team_id: 2 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/maintenance team/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('returns 422 when a crafted equipment_id belongs to another company', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],   // availability probe
            'maintenance.team': () => [],
            'maintenance.equipment': () => [{ id: 9, company_id: [2, 'Other Co'] }],
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, equipment_id: 9 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/equipment/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    // Unverified-ID write cases: when the verification lookup cannot confirm the
    // record (not found, or the read itself failed), the create must fail closed
    // rather than trusting the client-supplied id.
    it('returns 422 when a crafted equipment_id cannot be found', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],
            'maintenance.equipment': () => [],   // lookup returns nothing
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, equipment_id: 999 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/equipment/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('returns 422 when the equipment_id lookup itself fails', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],
            'maintenance.equipment': () => { throw new Error('odoo unavailable'); },
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, equipment_id: 5 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/equipment/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('returns 422 when a crafted maintenance_team_id cannot be found', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],   // selected team not among the company teams
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, maintenance_team_id: 999 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/maintenance team/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('returns 422 when a crafted production_id cannot be found', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],
            'mrp.production': () => [],   // MO not found
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, production_id: 999 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/manufacturing order/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('returns 422 when a crafted production_id belongs to another company', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],
            'mrp.production': () => [{ id: 5, company_id: [2, 'Other Co'] }],
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, production_id: 5 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/manufacturing order/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('pins company_id to the employee company on create', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [],
        }, { employeeCompanyId: 1 });
        mockClient.createRecord.mockResolvedValueOnce(73);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(mockClient.createRecord.mock.calls[0][2].company_id).toBe(1);
    });

    it('retries without the rejected optional maintenance field when Odoo rejects it', async () => {
        setupAvailable();
        mockClient.createRecord
            .mockRejectedValueOnce({ faultString: 'Invalid field schedule_date on maintenance.request' })
            .mockResolvedValueOnce(62);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, schedule_date: '2026-05-01T09:00:00Z', duration: 2.5 });

        expect(res.status).toBe(200);
        expect(mockClient.createRecord).toHaveBeenCalledTimes(2);
        const retryData = mockClient.createRecord.mock.calls[1][2];
        expect(retryData).not.toHaveProperty('schedule_date');
        expect(retryData.duration).toBe(2.5);
    });

    it('reports a user-supplied optional field that Odoo rejected as a dropped field', async () => {
        // The supplied production_id is verified against the employee company
        // before the create; it resolves to company 1 here, then Odoo rejects the
        // field at write time and the route drops it on retry.
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe
            'mrp.production': () => [{ id: 5, company_id: [1, 'My Company'] }],
        }, { employeeCompanyId: 1 });
        mockClient.createRecord
            .mockRejectedValueOnce({ faultString: 'Invalid field production_id on maintenance.request' })
            .mockResolvedValueOnce(70);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, production_id: 5 });

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(70);
        expect(res.body.partial_success).toBe(true);
        expect(res.body.dropped_fields).toEqual(['Manufacturing Order']);
        // The retry must not include the rejected field.
        const retryData = mockClient.createRecord.mock.calls[1][2];
        expect(retryData).not.toHaveProperty('production_id');
    });

    it('writes the MO link to whatever field the live schema names it', async () => {
        // This instance exposes the Manufacturing Order link as `x_mo_link`, not the
        // conventional `production_id`. The create must discover and use it.
        mockClient.getSchema.mockResolvedValue({
            x_mo_link: { type: 'many2one', relation: 'mrp.production', string: 'MO', required: false },
        });
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'mrp.production': () => [{ id: 5, company_id: [1, 'My Company'] }],
        }, { employeeCompanyId: 1 });
        mockClient.createRecord.mockResolvedValueOnce(80);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, production_id: 5 });

        expect(res.status).toBe(200);
        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.x_mo_link).toBe(5);
        expect(createArgs).not.toHaveProperty('production_id');
        expect(res.body.partial_success).toBeUndefined();
    });

    it('reports the MO link as dropped when the instance has no such field', async () => {
        // Schema is known and contains no many2one to mrp.production → the link
        // cannot persist. Report it instead of silently sending an invalid field.
        mockClient.getSchema.mockResolvedValue({
            name: { type: 'char', relation: undefined, string: 'Name', required: true },
        });
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'mrp.production': () => [{ id: 5, company_id: [1, 'My Company'] }],
        }, { employeeCompanyId: 1 });
        mockClient.createRecord.mockResolvedValueOnce(81);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, production_id: 5 });

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(81);
        expect(res.body.partial_success).toBe(true);
        expect(res.body.dropped_fields).toContain('Manufacturing Order');
        // No production_id / MO field was ever sent to Odoo.
        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('production_id');
    });

    it('does not report dropped_fields on a clean create', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(71);

        const res = await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, schedule_date: '2026-05-01T09:00:00Z' });

        expect(res.status).toBe(200);
        expect(res.body.partial_success).toBeUndefined();
        expect(res.body.dropped_fields).toBeUndefined();
    });

    it('formats schedule_date to YYYY-MM-DD HH:MM:SS', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(63);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, schedule_date: '2026-05-01T09:00:00.000Z' });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        // Must be formatted as 'YYYY-MM-DD HH:MM:SS', not ISO with T
        expect(createArgs.schedule_date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('passes preventive schedule end and recurrent fields when provided', async () => {
        setupAvailable();
        mockClient.createRecord.mockResolvedValueOnce(64);

        await request(app)
            .post('/maintenance')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                maintenance_type: 'preventive',
                schedule_date: '2026-05-01T09:00:00.000Z',
                schedule_end: '2026-05-01T11:00:00.000Z',
                recurring: true,
            });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.schedule_date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(createArgs.schedule_date_end).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(createArgs.recurring_maintenance).toBe(true);
    });
});

// ─── GET /maintenance/equipment ───────────────────────────────────────────────

describe('GET /maintenance/equipment', () => {
    it('returns equipment list when module available', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe
            'maintenance.equipment': () => [
                { id: 1, name: 'Printer A', category_id: [1, 'Office'], company_id: [1, 'Test Co'] },
                { id: 2, name: 'Server B', category_id: [2, 'IT'], company_id: [1, 'Test Co'] },
            ],
        });

        const res = await request(app)
            .get('/maintenance/equipment')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.equipment).toHaveLength(2);
    });

    it('excludes equipment from a different employee company', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.equipment': () => [
                { id: 1, name: 'My Printer', category_id: false, company_id: [1, 'My Company'] },
                { id: 2, name: 'Shared Asset', category_id: false, company_id: false },
                { id: 3, name: 'Other Printer', category_id: false, company_id: [2, 'Other'] },
            ],
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .get('/maintenance/equipment')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.equipment.map((e: any) => e.name)).toEqual(['My Printer', 'Shared Asset']);
    });

    it('fails closed when the company-aware query fails and the fallback cannot return company_id', async () => {
        // Primary domain'd query throws; the fallback also fails (e.g. company_id
        // unsupported). The route must return nothing rather than leak.
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe
            'maintenance.equipment': () => { throw new Error('company_id unsupported'); },
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .get('/maintenance/equipment')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.equipment).toEqual([]); // failed closed
    });

    it('returns available:false when module not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('not installed'));

        const res = await request(app)
            .get('/maintenance/equipment')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.equipment).toEqual([]);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/maintenance/equipment');
        expect(res.status).toBe(401);
    });
});

// ─── GET /maintenance/teams ───────────────────────────────────────────────────

describe('GET /maintenance/teams', () => {
    it('returns teams when module available', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [], // availability probe
            'maintenance.team': () => [
                { id: 1, name: 'Facilities Team', company_id: [1, 'Test Co'] },
                { id: 2, name: 'IT Team', company_id: [1, 'Test Co'] },
            ],
        });

        const res = await request(app)
            .get('/maintenance/teams')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.teams).toHaveLength(2);
    });

    it('returns available:false when module not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('not installed'));

        const res = await request(app)
            .get('/maintenance/teams')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.teams).toEqual([]);
    });

    it('filters teams from a different employee company', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'maintenance.team': () => [
                { id: 1, name: 'Same Company', company_id: [1, 'My Company'] },
                { id: 2, name: 'Global Team', company_id: false },
                { id: 3, name: 'Other Company', company_id: [2, 'Other'] },
            ],
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .get('/maintenance/teams')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.teams.map((team: any) => team.name)).toEqual(['Same Company', 'Global Team']);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/maintenance/teams');
        expect(res.status).toBe(401);
    });
});

// ─── Resilience: unknown/custom Odoo fields ────────────────────────────────────

describe('GET /maintenance/manufacturing-orders', () => {
    it('returns company-scoped manufacturing orders when MRP is available', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'mrp.production': () => [
                { id: 1, name: 'MO/001', company_id: [1, 'My Company'] },
                { id: 2, name: 'MO/002', company_id: [2, 'Other'] },
                { id: 3, name: 'MO/003', company_id: false },
            ],
        }, { employeeCompanyId: 1 });

        const res = await request(app)
            .get('/maintenance/manufacturing-orders')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.orders.map((order: any) => order.name)).toEqual(['MO/001', 'MO/003']);
    });

    it('returns an empty optional list when MRP is unavailable', async () => {
        mockSearchReadByModel(mockClient, {
            'maintenance.request': () => [],
            'mrp.production': () => {
                throw new Error('model not found');
            },
        });

        const res = await request(app)
            .get('/maintenance/manufacturing-orders')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.orders).toEqual([]);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/maintenance/manufacturing-orders');
        expect(res.status).toBe(401);
    });
});

describe('GET /maintenance — resilience: unknown Odoo fields', () => {
    it('succeeds when Odoo returns extra unknown custom fields on requests', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 0 }]) // availability probe
            .mockResolvedValueOnce([
                {
                    id: 1, name: 'AC unit broken', stage_id: [2, 'New'],
                    maintenance_team_id: [1, 'Facilities'],
                    x_custom_asset_tag: 'AC-017',
                    x_studio_priority_override: null,
                },
            ]);

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.requests).toHaveLength(1);
        expect(res.body.requests[0].name).toBe('AC unit broken');
    });

    it('handles maintenance_team_id as null without crashing', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 0 }])
            .mockResolvedValueOnce([
                { id: 2, name: 'No team', stage_id: [1, 'New'], maintenance_team_id: null },
            ]);

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.requests).toHaveLength(1);
    });

    it('handles stage_id as null without crashing', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 0 }])
            .mockResolvedValueOnce([
                { id: 3, name: 'No stage', stage_id: null, maintenance_team_id: false },
            ]);

        const res = await request(app)
            .get('/maintenance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.requests).toHaveLength(1);
    });
});
