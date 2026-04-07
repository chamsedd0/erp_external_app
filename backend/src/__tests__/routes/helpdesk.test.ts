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

// isHelpdeskAvailable calls searchRead on 'helpdesk.ticket'.
// If it resolves → available=true. If it throws → available=false.

// ─── GET /helpdesk/teams ───────────────────────────────────────────────────────

describe('GET /helpdesk/teams', () => {
    it('returns teams when helpdesk module is available', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([]) // availability probe
            .mockResolvedValueOnce([   // helpdesk.team
                { id: 1, name: 'Support Team' },
                { id: 2, name: 'Technical Team' },
            ]);

        const res = await request(app)
            .get('/helpdesk/teams')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.teams).toHaveLength(2);
    });

    it('returns available:false when helpdesk module is not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('model not found: helpdesk.ticket'));

        const res = await request(app)
            .get('/helpdesk/teams')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.teams).toEqual([]);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/helpdesk/teams');
        expect(res.status).toBe(401);
    });

    it('returns 401 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/helpdesk/teams')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });
});

// ─── GET /helpdesk ─────────────────────────────────────────────────────────────

describe('GET /helpdesk', () => {
    it('returns tickets for employee when partner can be resolved', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // availability probe
            .mockResolvedValueOnce([{ id: 42, name: 'Alice', user_id: [10, 'alice'] }]) // hr.employee
            .mockResolvedValueOnce([{ id: 10, partner_id: [99, 'Alice Partner'] }])     // res.users
            .mockResolvedValueOnce([                                                     // helpdesk.ticket
                { id: 100, name: 'My issue', stage_id: [1, 'New'], create_date: '2025-01-10 10:00:00' },
            ]);

        const res = await request(app)
            .get('/helpdesk?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.tickets).toHaveLength(1);
    });

    it('returns empty tickets when partner_id cannot be resolved', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // availability probe
            .mockResolvedValueOnce([{ id: 42, name: 'Bob', user_id: false }]) // no user_id
        ;

        const res = await request(app)
            .get('/helpdesk?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.tickets).toEqual([]);
    });

    it('returns available:false when helpdesk module unavailable', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('helpdesk not installed'));

        const res = await request(app)
            .get('/helpdesk?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.tickets).toEqual([]);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .get('/helpdesk')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });

    it('returns 404 when employee not found in Odoo', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // availability probe
            .mockResolvedValueOnce([]); // hr.employee not found

        const res = await request(app)
            .get('/helpdesk?employee_id=999')
            .set('Authorization', authHeader());

        expect(res.status).toBe(404);
    });
});

// ─── POST /helpdesk ────────────────────────────────────────────────────────────

describe('POST /helpdesk', () => {
    const VALID_BODY = {
        employee_id: 42,
        name: 'Cannot login to system',
        description: 'I get an error when I try to login',
        team_id: 1,
    };

    function setupAvailableWithEmployee(partnerId: number | null = 99) {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // availability probe
            .mockResolvedValueOnce([{ id: 42, name: 'Alice', user_id: [10, 'alice'], work_email: 'alice@test.com' }]) // hr.employee
            .mockResolvedValueOnce(partnerId !== null
                ? [{ id: 10, partner_id: [partnerId, 'Alice Partner'] }]
                : [{ id: 10, partner_id: false }]
            ); // res.users
    }

    it('creates ticket and returns 200 with id', async () => {
        setupAvailableWithEmployee(99);
        mockClient.createRecord.mockResolvedValueOnce(200);

        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.available).toBe(true);
    });

    it('includes partner_id in ticket data when resolved', async () => {
        setupAvailableWithEmployee(99);
        mockClient.createRecord.mockResolvedValueOnce(201);

        await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0];
        expect(createArgs[2]).toHaveProperty('partner_id', 99);
    });

    it('creates ticket without partner_id when user has no partner', async () => {
        setupAvailableWithEmployee(null);
        mockClient.createRecord.mockResolvedValueOnce(202);

        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        const createArgs = mockClient.createRecord.mock.calls[0];
        expect(createArgs[2]).not.toHaveProperty('partner_id');
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, name: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, employee_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns available:false when helpdesk module unavailable', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('module not installed'));

        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
    });

    it('calls uploadAttachments when attachments provided', async () => {
        setupAvailableWithEmployee(99);
        mockClient.createRecord.mockResolvedValueOnce(203);

        await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'screenshot.png', data: 'base64data==', mimetype: 'image/png' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(
            1, expect.any(Array), 'helpdesk.ticket', 203
        );
    });

    it('returns 500 when Odoo createRecord throws', async () => {
        setupAvailableWithEmployee(99);
        mockClient.createRecord.mockRejectedValueOnce(new Error('Odoo RPC error'));

        const res = await request(app)
            .post('/helpdesk')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });
});
