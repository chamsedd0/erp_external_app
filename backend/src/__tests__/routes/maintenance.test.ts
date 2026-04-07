import request from 'supertest';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { getOdooClient } from '../../odoo/client';
import { authHeader, SAMPLE_TENANT, makeMockOdooClient } from './helpers';

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
        mockClient.searchRead
            .mockResolvedValueOnce([]) // availability probe
            .mockResolvedValueOnce([
                { id: 1, name: 'HVAC' },
                { id: 2, name: 'Electrical' },
            ]);

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

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .get('/maintenance')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
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
            1, expect.any(Array), 'maintenance.request', 60
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
});
