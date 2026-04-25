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

// ─── GET /attendance ──────────────────────────────────────────────────────────

describe('GET /attendance', () => {
    const RECORDS = [
        { id: 1, employee_id: [42, 'Alice'], check_in: '2026-04-20 08:00:00', check_out: '2026-04-20 17:00:00', worked_hours: 9 },
        { id: 2, employee_id: [42, 'Alice'], check_in: '2026-04-21 08:00:00', check_out: '2026-04-21 16:00:00', worked_hours: 8 },
    ];

    it('returns records for a valid JWT', async () => {
        mockClient.searchRead.mockResolvedValueOnce(RECORDS);

        const res = await request(app)
            .get('/attendance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.records).toHaveLength(2);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/attendance?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .get('/attendance')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });

    it('returns 401 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/attendance?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });

    it('sorts records by check_in descending and caps at 30', async () => {
        // Create 35 records with sequential check_in dates
        const manyRecords = Array.from({ length: 35 }, (_, i) => ({
            id: i + 1,
            employee_id: [42, 'Alice'],
            check_in: `2026-04-${String(i + 1).padStart(2, '0')} 08:00:00`,
            check_out: null,
            worked_hours: 0,
        }));
        mockClient.searchRead.mockResolvedValueOnce(manyRecords);

        const res = await request(app)
            .get('/attendance?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.records).toHaveLength(30);
        // Most recent should be first
        expect(new Date(res.body.records[0].check_in).getTime())
            .toBeGreaterThan(new Date(res.body.records[1].check_in).getTime());
    });

    it('returns 500 when Odoo searchRead throws', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('Odoo connection error'));
        const res = await request(app)
            .get('/attendance?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(500);
    });

    it('returns empty records with a message when access is denied', async () => {
        mockClient.searchRead.mockRejectedValueOnce({ message: 'Access denied to hr.attendance' });
        const res = await request(app)
            .get('/attendance?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
        expect(res.body.records).toHaveLength(0);
        expect(res.body.message).toBeDefined();
    });
});

// ─── GET /attendance/overtime ─────────────────────────────────────────────────

describe('GET /attendance/overtime', () => {
    it('returns available:true with records when model exists', async () => {
        // First call: probe (resolves) → model available
        // Second call: actual fetch
        mockClient.searchRead
            .mockResolvedValueOnce([]) // probe
            .mockResolvedValueOnce([
                { id: 1, date: '2026-04-01', duration: 2.5, state: 'draft', create_date: '2026-04-01' },
            ]);

        const res = await request(app)
            .get('/attendance/overtime?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(true);
        expect(res.body.records).toHaveLength(1);
    });

    it('returns available:false when model not installed', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('Model hr.attendance.overtime not found'));

        const res = await request(app)
            .get('/attendance/overtime?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.records).toHaveLength(0);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/attendance/overtime?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .get('/attendance/overtime')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });
});

// ─── POST /attendance/correction ─────────────────────────────────────────────

describe('POST /attendance/correction', () => {
    const VALID_BODY = {
        employee_id: 42,
        check_in: '2026-04-20T08:00:00.000Z',
        check_out: '2026-04-20T17:00:00.000Z',
        reason: 'Forgot to clock in',
    };

    it('creates an attendance record and returns success', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);

        const res = await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.id).toBe(55);
    });

    it('includes check_out in record when provided', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);

        await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0];
        expect(createArgs[2]).toHaveProperty('check_out');
    });

    it('omits check_out when not provided', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);

        await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send({ employee_id: 42, check_in: '2026-04-20T08:00:00.000Z' });

        const createArgs = mockClient.createRecord.mock.calls[0];
        expect(createArgs[2]).not.toHaveProperty('check_out');
    });

    it('calls callMethod with reason when reason is provided', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);
        mockClient.callMethod.mockResolvedValueOnce(true);

        await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(mockClient.callMethod).toHaveBeenCalledWith(
            1, 'hr.attendance', 'message_post', [55],
            expect.objectContaining({ body: expect.stringContaining('Forgot to clock in') })
        );
    });

    it('skips chatter silently when callMethod throws', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);
        mockClient.callMethod.mockRejectedValueOnce(new Error('Chatter not accessible'));

        const res = await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        // Should still succeed — chatter failure is silent
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send({ check_in: '2026-04-20T08:00:00.000Z' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when check_in is missing', async () => {
        const res = await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send({ employee_id: 42 });
        expect(res.status).toBe(400);
    });

    it('returns 500 when createRecord throws', async () => {
        mockClient.createRecord.mockRejectedValueOnce(new Error('Odoo RPC error'));

        const res = await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });

    it('uploads attachments when provided', async () => {
        mockClient.createRecord.mockResolvedValueOnce(55);

        await request(app)
            .post('/attendance/correction')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'photo.jpg', data: 'base64==', mimetype: 'image/jpeg' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(
            1, expect.any(Array), 'hr.attendance', 55
        );
    });
});

// ─── POST /attendance/overtime ────────────────────────────────────────────────

describe('POST /attendance/overtime', () => {
    const VALID_BODY = {
        employee_id: 42,
        date: '2026-04-20',
        duration: 2.5,
        reason: 'Project deadline',
    };

    it('returns 422 with available:false when model not installed', async () => {
        // Probe rejects → unavailable
        mockClient.searchRead.mockRejectedValueOnce(new Error('Model not found'));

        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(422);
        expect(res.body.available).toBe(false);
    });

    it('creates overtime record and returns id', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // probe: available
        mockClient.createRecord.mockResolvedValueOnce(77);

        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.id).toBe(77);
    });

    it('retries without duration when first create rejects with Invalid field', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // probe: available
        mockClient.createRecord
            .mockRejectedValueOnce({ faultString: 'Invalid field duration' })
            .mockResolvedValueOnce(77);

        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(mockClient.createRecord).toHaveBeenCalledTimes(2);
        // Second call should not have duration
        const secondCallArgs = mockClient.createRecord.mock.calls[1][2];
        expect(secondCallArgs).not.toHaveProperty('duration');
    });

    it('returns 400 on Zod validation failure (missing date)', async () => {
        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send({ employee_id: 42, duration: 2 }); // missing date
        expect(res.status).toBe(400);
    });

    it('returns 400 on non-positive duration', async () => {
        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, duration: -1 });
        expect(res.status).toBe(400);
    });

    it('returns 500 on unexpected Odoo error', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // probe: available
        mockClient.createRecord.mockRejectedValueOnce(new Error('Unexpected Odoo error'));

        const res = await request(app)
            .post('/attendance/overtime')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });
});

// ─── POST /attendance/justification ──────────────────────────────────────────

describe('POST /attendance/justification', () => {
    const VALID_BODY = {
        employee_id: 42,
        leave_type_id: 3,
        date_from: '2026-04-20T00:00:00.000Z',
        date_to: '2026-04-21T23:59:59.000Z',
        justification: 'I was sick with a fever',
    };

    it('creates hr.leave record using detected leave type field', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // leave type field probe → holiday_status_id
        mockClient.createRecord.mockResolvedValueOnce(88);

        const res = await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.id).toBe(88);
    });

    it('uses justification text as the leave name field', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]);
        mockClient.createRecord.mockResolvedValueOnce(88);

        await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.name).toBe('I was sick with a fever');
    });

    it('falls back to holiday_status_id on KeyError', async () => {
        const justifTenant = 'justif-fallback-tenant';
        mockClient.searchRead.mockResolvedValueOnce([]); // probe → holiday_status_id
        mockClient.createRecord
            .mockRejectedValueOnce({ faultString: 'KeyError: None' })
            .mockResolvedValueOnce(88);

        const res = await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader({ tenantId: justifTenant }))
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(mockClient.createRecord).toHaveBeenCalledTimes(2);
        const retryArgs = mockClient.createRecord.mock.calls[1][2];
        expect(retryArgs).toHaveProperty('holiday_status_id');
    });

    it('uploads attachments when provided', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]);
        mockClient.createRecord.mockResolvedValueOnce(88);

        await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'cert.pdf', data: 'base64==', mimetype: 'application/pdf' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(1, expect.any(Array), 'hr.leave', 88);
    });

    it('returns 400 when justification text is missing', async () => {
        const res = await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, justification: '' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when leave_type_id is missing', async () => {
        const res = await request(app)
            .post('/attendance/justification')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, leave_type_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app)
            .post('/attendance/justification')
            .send(VALID_BODY);
        expect(res.status).toBe(401);
    });
});
