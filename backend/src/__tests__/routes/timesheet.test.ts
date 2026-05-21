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

// ─── GET /timesheet ─────────────────────────────────────────────────────────────

describe('GET /timesheet', () => {
    it('returns entries sorted by date descending', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'Coding', date: '2025-01-10', unit_amount: 3 },
            { id: 2, name: 'Meetings', date: '2025-01-15', unit_amount: 1.5 },
        ]);

        const res = await request(app)
            .get('/timesheet?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.entries[0].id).toBe(2); // newer date first
        expect(res.body.entries[1].id).toBe(1);
    });

    it('caps results at 50', async () => {
        const manyEntries = Array.from({ length: 60 }, (_, i) => ({
            id: i + 1,
            name: `Task ${i + 1}`,
            date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
            unit_amount: 1,
        }));
        mockClient.searchRead.mockResolvedValueOnce(manyEntries);

        const res = await request(app)
            .get('/timesheet?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.body.entries).toHaveLength(50);
    });

    it('derives employee_id from JWT when query parameter is missing', async () => {
        const res = await request(app)
            .get('/timesheet')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/timesheet?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('returns 401 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/timesheet?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });

    it('returns 500 when Odoo throws', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('Odoo error'));
        const res = await request(app)
            .get('/timesheet?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(500);
    });
});

// ─── GET /timesheet/projects ───────────────────────────────────────────────────

describe('GET /timesheet/projects', () => {
    it('returns active projects', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'Project Alpha' },
            { id: 2, name: 'Project Beta' },
        ]);

        const res = await request(app)
            .get('/timesheet/projects')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.projects).toHaveLength(2);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/timesheet/projects');
        expect(res.status).toBe(401);
    });

    it('returns 500 on Odoo error', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('RPC error'));
        const res = await request(app)
            .get('/timesheet/projects')
            .set('Authorization', authHeader());
        expect(res.status).toBe(500);
    });
});

// ─── GET /timesheet/tasks ──────────────────────────────────────────────────────

describe('GET /timesheet/tasks', () => {
    it('returns tasks for given project_id', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 10, name: 'Design UI' },
            { id: 11, name: 'Write tests' },
        ]);

        const res = await request(app)
            .get('/timesheet/tasks?project_id=1')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.tasks).toHaveLength(2);
    });

    it('filters tasks linked to time off types', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 10, name: 'Client Work', leave_type_id: false },
            { id: 11, name: 'Time Off Task', leave_type_id: [1, 'Annual Leave'] },
        ]);

        const res = await request(app)
            .get('/timesheet/tasks?project_id=1')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.tasks).toHaveLength(1);
        expect(res.body.tasks[0].name).toBe('Client Work');
    });

    it('returns 400 when project_id is missing', async () => {
        const res = await request(app)
            .get('/timesheet/tasks')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });

    it('returns 400 when project_id is not a number', async () => {
        const res = await request(app)
            .get('/timesheet/tasks?project_id=abc')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });
});

// ─── POST /timesheet ───────────────────────────────────────────────────────────

describe('POST /timesheet', () => {
    const VALID_BODY = {
        employee_id: 42,
        project_id: 1,
        date: '2025-06-20',
        unit_amount: 2.5,
        name: 'Implemented authentication flow',
    };

    it('creates timesheet entry and returns 200 with id', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }]) // project existence check
            .mockResolvedValueOnce([{ analytic_account_id: [10, 'Alpha Account'] }]); // analytic account
        mockClient.createRecord.mockResolvedValueOnce(300);

        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(300);
        expect(res.body.status).toBe('success');
    });

    it('includes account_id in record when analytic account resolves', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: [10, 'Alpha Account'] }]);
        mockClient.createRecord.mockResolvedValueOnce(301);

        await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.account_id).toBe(10);
    });

    it('omits account_id when analytic_account_id field is absent (Odoo v15)', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockRejectedValueOnce(new Error('field analytic_account_id not found')); // field absent
        mockClient.createRecord.mockResolvedValueOnce(302);

        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('account_id');
    });

    it('omits account_id when analytic_account_id is false', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: false }]);
        mockClient.createRecord.mockResolvedValueOnce(303);

        await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('account_id');
    });

    it('includes task_id in record when provided', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: false }]);
        mockClient.createRecord.mockResolvedValueOnce(304);

        await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, task_id: 99 });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.task_id).toBe(99);
    });

    it('returns 422 when Odoo rejects a task linked to time off', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: false }]);
        mockClient.createRecord.mockRejectedValueOnce({ faultString: 'You cannot create timesheets for a task that is linked to a time off type. Please use the Time Off application.' });

        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, task_id: 99 });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/time off type/i);
    });

    it('omits task_id when not provided', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: false }]);
        mockClient.createRecord.mockResolvedValueOnce(305);

        await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('task_id');
    });

    it('returns 400 when project_id is missing', async () => {
        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, project_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when unit_amount is missing', async () => {
        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, unit_amount: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when project is not found in Odoo', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // project not found

        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/project not found/i);
    });

    it('returns 500 when createRecord throws', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Project Alpha' }])
            .mockResolvedValueOnce([{ analytic_account_id: false }]);
        mockClient.createRecord.mockRejectedValueOnce(new Error('Odoo RPC failure'));

        const res = await request(app)
            .post('/timesheet')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });
});
