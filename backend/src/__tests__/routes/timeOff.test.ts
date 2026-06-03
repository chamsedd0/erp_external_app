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

// ─── GET /time-off ─────────────────────────────────────────────────────────────

describe('GET /time-off', () => {
    it('returns leave list for a valid JWT', async () => {
        // First call: probe for leave type field (will succeed)
        mockClient.searchRead
            .mockResolvedValueOnce([]) // probe
            .mockResolvedValueOnce([{ id: 1, name: 'Annual Leave', state: 'validate', employee_id: [42, 'Alice'], work_entry_type_id: [5, 'Annual'] }]);

        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('leaves');
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/time-off?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('returns 401 when tenantId not found in Redis', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });

    it('derives employee_id from JWT when query param is missing', async () => {
        const res = await request(app)
            .get('/time-off')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
    });

    it('returns 500 when Odoo searchRead throws', async () => {
        mockClient.searchRead.mockRejectedValue(new Error('Odoo connection refused'));
        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(500);
    });
});

// ─── GET /time-off/types ───────────────────────────────────────────────────────

describe('GET /time-off/types', () => {
    it('returns leave types from hr.leave.type', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'Annual Leave' },
            { id: 2, name: 'Sick Leave' },
        ]);

        const res = await request(app)
            .get('/time-off/types')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.types).toHaveLength(2);
    });

    it('falls back to hr.work.entry.type when hr.leave.type returns empty', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([]) // hr.leave.type returns nothing
            .mockResolvedValueOnce([  // hr.work.entry.type
                { id: 10, name: 'Annual Leave', code: 'LEAVE_ANNUAL' },
                { id: 11, name: 'Sick Leave', code: 'LEAVE_SICK' },
                { id: 12, name: 'Work Entry', code: 'WORK_NORMAL' },
            ]);

        const res = await request(app)
            .get('/time-off/types')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        // Only LEAVE_ prefixed entries should be returned
        expect(res.body.types.every((t: any) => !t.code?.startsWith('WORK'))).toBe(true);
    });

    it('adds requestability metadata when leave balance fields are available', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'Annual Leave', requires_allocation: 'yes', virtual_remaining_leaves: 0, max_leaves: 0 },
            { id: 2, name: 'Unpaid Leave', requires_allocation: 'no', virtual_remaining_leaves: 0, max_leaves: 0 },
        ]);

        const res = await request(app)
            .get('/time-off/types')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.types[0].requestable).toBe(false);
        expect(res.body.types[0].unavailable_reason).toMatch(/allocation/i);
        expect(res.body.types[1].requestable).toBe(true);
    });
});

// ─── GET /time-off/pending ─────────────────────────────────────────────────────

describe('GET /time-off/pending', () => {
    it('returns pending leaves (state in draft/confirm)', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 5, name: null, state: 'confirm', date_from: '2025-01-10 00:00:00', date_to: '2025-01-12 00:00:00', number_of_days: 2 },
        ]);

        const res = await request(app)
            .get('/time-off/pending?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.leaves).toHaveLength(1);
    });
});

// ─── POST /time-off ────────────────────────────────────────────────────────────

describe('POST /time-off', () => {
    const VALID_BODY = {
        employee_id: 42,
        leave_type_id: 1,
        date_from: '2025-06-10T00:00:00',
        date_to: '2025-06-12T00:00:00',
        name: 'Summer break',
    };

    it('creates leave record and returns 200 with id', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // probe
        mockClient.createRecord.mockResolvedValueOnce(101);

        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(101);
        expect(res.body.status).toBe('success');
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, employee_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when date_from is missing', async () => {
        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, date_from: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when leave_type_id is missing', async () => {
        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, leave_type_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 500 when Odoo createRecord throws', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // probe
        mockClient.createRecord.mockRejectedValueOnce(new Error('Odoo RPC error'));

        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });

    it('calls uploadAttachments when attachments are provided', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]);
        mockClient.createRecord.mockResolvedValueOnce(55);

        await request(app)
            .post('/time-off')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'doc.pdf', data: 'base64data==', mimetype: 'application/pdf' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(1, expect.any(Array), 'hr.leave', 55, expect.any(Object));
    });

    it('probe tries holiday_status_id when work_entry_type_id raises Invalid field', async () => {
        // Use a fresh tenant so the _leaveTypeField module-level cache is clean for this probe
        const probeTenant = 'probe-tenant-holiday';
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);

        // Probe order in time_off.ts: ['holiday_status_id', 'leave_type_id', 'time_off_type_id', 'work_entry_type_id']
        // holiday_status_id is the FIRST candidate — resolve on first probe to cache and use it
        mockClient.searchRead
            .mockResolvedValueOnce([]); // holiday_status_id probe succeeds immediately
        mockClient.createRecord.mockResolvedValueOnce(200);

        const res = await request(app)
            .post('/time-off')
            .set('Authorization', authHeader({ tenantId: probeTenant }))
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        const createArgs = mockClient.createRecord.mock.calls[0];
        expect(Object.keys(createArgs[2])).toContain('holiday_status_id');
    });
});

// ─── Resilience: leave type field probe edge cases ────────────────────────────

describe('time-off — resilience: leave type field probe', () => {
    // Use a unique tenantId per test so the module-level _leaveTypeField cache
    // is always cold — jest.clearAllMocks() does NOT clear module-level state.
    let probeTenant: string;

    beforeEach(() => {
        probeTenant = 'resilience-' + Math.random().toString(36).slice(2, 8);
    });

    it('succeeds when Odoo returns extra custom fields in leave response', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])  // probe (cold cache — always runs)
            .mockResolvedValueOnce([
                {
                    id: 10,
                    name: 'Annual Leave',
                    state: 'validate',
                    employee_id: [42, 'Alice'],
                    work_entry_type_id: [5, 'Annual'],
                    x_custom_approval_level: 'manager',  // unknown custom field
                    custom_notes: 'Need this approved',  // another custom field
                },
            ]);

        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader({ tenantId: probeTenant }));

        expect(res.status).toBe(200);
        expect(res.body.leaves).toHaveLength(1);
    });

    it('handles state as null without crashing', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                { id: 11, name: 'Sick Leave', state: null, employee_id: [42, 'Alice'], work_entry_type_id: [3, 'Sick'] },
            ]);

        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader({ tenantId: probeTenant }));

        expect(res.status).toBe(200);
        expect(res.body.leaves[0].state).toBeNull();
    });

    it('falls back to reading without leave type field when field is rejected at runtime', async () => {
        // probe succeeds with work_entry_type_id, then runtime rejects it, then retries without field
        mockClient.searchRead
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('Invalid field: work_entry_type_id'))  // runtime rejection
            .mockResolvedValueOnce([                                                  // retry without field
                { id: 12, name: 'Leave', state: 'validate', employee_id: [42, 'Alice'] },
            ]);

        const res = await request(app)
            .get('/time-off?employee_id=42')
            .set('Authorization', authHeader({ tenantId: probeTenant }));

        expect(res.status).toBe(200);
        expect(res.body.leaves).toHaveLength(1);
    });
});
