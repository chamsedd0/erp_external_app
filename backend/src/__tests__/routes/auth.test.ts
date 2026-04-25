import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { pushStore } from '../../lib/pushStore';
import { getOdooClient } from '../../odoo/client';
import { SAMPLE_TENANT } from './helpers';

// Preserve applyTenantDefaults (pure function) while mocking tenantStore methods
jest.mock('../../lib/tenantStore', () => {
    const actual = jest.requireActual('../../lib/tenantStore');
    return {
        ...actual,
        tenantStore: {
            getTenant: jest.fn(),
            saveTenant: jest.fn(),
            deleteTenant: jest.fn(),
            listTenants: jest.fn(),
        },
    };
});
jest.mock('../../lib/pushStore');
jest.mock('../../odoo/client');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockPushStore = pushStore as jest.Mocked<typeof pushStore>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;

const TEST_JWT_SECRET = process.env.JWT_SECRET!;
const TEST_ADMIN_SECRET = process.env.ADMIN_SECRET!;

const MOCK_ODOO_CLIENT = {
    authenticate: jest.fn().mockResolvedValue(1),
    searchEmployee: jest.fn(),
    searchRead: jest.fn(),
    createRecord: jest.fn(),
    writeRecord: jest.fn(),
    uploadAttachments: jest.fn(),
    callMethod: jest.fn(),
    getVersion: jest.fn().mockResolvedValue(17),
    getSchema: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetOdooClient.mockReturnValue(MOCK_ODOO_CLIENT as any);
});

// ─── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
    const EMPLOYEE = { id: 7, name: 'Alice', department_id: [1, 'Sales'], job_title: 'Manager', work_email: 'alice@test.com' };

    it('returns 200 + token on valid credentials', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        MOCK_ODOO_CLIENT.searchEmployee.mockResolvedValue([EMPLOYEE]);

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234', tenant_slug: 'testcorp' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.name).toBe('Alice');
    });

    it('JWT payload contains id, name, role, and tenantId', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        MOCK_ODOO_CLIENT.searchEmployee.mockResolvedValue([EMPLOYEE]);

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234', tenant_slug: 'testcorp' });

        const decoded: any = jwt.verify(res.body.token, TEST_JWT_SECRET);
        expect(decoded.id).toBe(EMPLOYEE.id);
        expect(decoded.name).toBe('Alice');
        expect(decoded.role).toBe('employee');
        expect(decoded.tenantId).toBe('testcorp');
    });

    it('returns 401 when tenant slug is unknown', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234', tenant_slug: 'unknown' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/unknown company/i);
    });

    it('returns 403 when tenant is suspended', async () => {
        mockTenantStore.getTenant.mockResolvedValue({
            ...SAMPLE_TENANT,
            subscription_status: 'suspended',
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234', tenant_slug: 'testcorp' });

        expect(res.status).toBe(403);
    });

    it('returns 403 when tenant is disabled', async () => {
        mockTenantStore.getTenant.mockResolvedValue({ ...SAMPLE_TENANT, enabled: false });

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234', tenant_slug: 'testcorp' });

        expect(res.status).toBe(403);
    });

    it('returns 401 when employee not found (wrong PIN)', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        MOCK_ODOO_CLIENT.searchEmployee.mockResolvedValue([]);

        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '0000', tenant_slug: 'testcorp' });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/invalid credentials/i);
    });

    it('returns 400 when tenant_slug is missing', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', pin: '1234' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ pin: '1234', tenant_slug: 'testcorp' });
        expect(res.status).toBe(400);
    });

    it('returns 400 when pin is missing', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ employee_id: 'EMP007', tenant_slug: 'testcorp' });
        expect(res.status).toBe(400);
    });
});

// ─── GET /auth/tenant/:slug ────────────────────────────────────────────────────

describe('GET /auth/tenant/:slug', () => {
    it('returns name and hr_email for a known slug', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);

        const res = await request(app).get('/auth/tenant/testcorp');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Test Corp');
        expect(res.body.hr_email).toBe('hr@testcorp.com');
        // Must NOT expose credentials
        expect(res.body).not.toHaveProperty('odoo_password');
        expect(res.body).not.toHaveProperty('odoo_username');
        expect(res.body).not.toHaveProperty('odoo_url');
    });

    it('returns 404 for an unknown slug', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app).get('/auth/tenant/nonexistent');
        expect(res.status).toBe(404);
    });
});

// ─── POST /auth/push-token ─────────────────────────────────────────────────────

describe('POST /auth/push-token', () => {
    it('saves token and returns success', async () => {
        mockPushStore.saveToken.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/auth/push-token')
            .send({ employee_id: 42, token: 'ExponentPushToken[abc]', tenant_slug: 'testcorp' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockPushStore.saveToken).toHaveBeenCalledWith('testcorp', 42, 'ExponentPushToken[abc]');
    });

    it('returns 400 with missing fields', async () => {
        const res = await request(app)
            .post('/auth/push-token')
            .send({ employee_id: 42 }); // missing token and tenant_slug
        expect(res.status).toBe(400);
    });
});

// ─── DELETE /auth/push-token ───────────────────────────────────────────────────

describe('DELETE /auth/push-token', () => {
    it('removes token and returns success', async () => {
        mockPushStore.removeToken.mockResolvedValue(undefined);

        const res = await request(app)
            .delete('/auth/push-token')
            .send({ employee_id: 42, tenant_slug: 'testcorp' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockPushStore.removeToken).toHaveBeenCalledWith('testcorp', 42);
    });
});

// ─── GET /admin/tenants ────────────────────────────────────────────────────────

describe('GET /admin/tenants', () => {
    it('returns tenant array for correct admin secret', async () => {
        mockTenantStore.listTenants.mockResolvedValue({ testcorp: SAMPLE_TENANT });

        const res = await request(app)
            .get('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].slug).toBe('testcorp');
        // Passwords must be stripped
        expect(res.body[0]).not.toHaveProperty('odoo_password');
        expect(res.body[0]).not.toHaveProperty('odoo_username');
    });

    it('returns subscription fields in the response', async () => {
        mockTenantStore.listTenants.mockResolvedValue({ testcorp: SAMPLE_TENANT });

        const res = await request(app)
            .get('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.body[0].subscription_plan).toBe('professional');
        expect(res.body[0].subscription_status).toBe('active');
        expect(res.body[0].monthly_amount).toBe(299);
    });

    it('returns 403 for wrong admin secret', async () => {
        const res = await request(app)
            .get('/admin/tenants')
            .set('x-admin-secret', 'wrong-secret');
        expect(res.status).toBe(403);
    });

    it('returns 403 when admin secret is missing', async () => {
        const res = await request(app).get('/admin/tenants');
        expect(res.status).toBe(403);
    });
});

// ─── POST /admin/tenants ──────────────────────────────────────────────────────

describe('POST /admin/tenants', () => {
    const VALID_BODY = {
        slug: 'newco',
        name: 'New Co',
        hr_email: 'hr@newco.com',
        odoo_url: 'https://newco.odoo.com',
        odoo_db: 'newco_db',
        odoo_username: 'admin@newco.com',
        odoo_password: 'secret123',
        contact_name: 'Bob Jones',
        contact_email: 'bob@newco.com',
        subscription_plan: 'professional',
        subscription_status: 'trial',
        subscription_start: '2026-01-01',
        subscription_renewal: '2026-07-01',
        monthly_amount: 199,
    };

    it('creates tenant with valid body and correct secret', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        mockTenantStore.saveTenant.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.slug).toBe('newco');
        expect(mockTenantStore.saveTenant).toHaveBeenCalledWith(
            'newco',
            expect.objectContaining({ name: 'New Co', subscription_plan: 'professional' })
        );
    });

    it('preserves created_at when updating an existing tenant', async () => {
        const ORIGINAL_CREATED = '2025-03-01T00:00:00.000Z';
        mockTenantStore.getTenant.mockResolvedValue({ ...SAMPLE_TENANT, created_at: ORIGINAL_CREATED });
        mockTenantStore.saveTenant.mockResolvedValue(undefined);

        await request(app)
            .post('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send({ ...VALID_BODY, slug: 'testcorp' });

        const saved = (mockTenantStore.saveTenant as jest.Mock).mock.calls[0][1];
        expect(saved.created_at).toBe(ORIGINAL_CREATED);
    });

    it('returns 400 with missing required field', async () => {
        const res = await request(app)
            .post('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send({ ...VALID_BODY, hr_email: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 403 with wrong admin secret', async () => {
        const res = await request(app)
            .post('/admin/tenants')
            .set('x-admin-secret', 'wrong')
            .send(VALID_BODY);
        expect(res.status).toBe(403);
    });
});

// ─── GET /admin/tenants/:slug ─────────────────────────────────────────────────

describe('GET /admin/tenants/:slug', () => {
    it('returns single tenant without password', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);

        const res = await request(app)
            .get('/admin/tenants/testcorp')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Test Corp');
        expect(res.body.slug).toBe('testcorp');
        expect(res.body).not.toHaveProperty('odoo_password');
    });

    it('returns 404 when slug not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        const res = await request(app)
            .get('/admin/tenants/nonexistent')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(404);
    });

    it('returns 403 without admin secret', async () => {
        const res = await request(app).get('/admin/tenants/testcorp');
        expect(res.status).toBe(403);
    });
});

// ─── PUT /admin/tenants/:slug ─────────────────────────────────────────────────

describe('PUT /admin/tenants/:slug', () => {
    it('updates subscription_status to overdue', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        mockTenantStore.saveTenant.mockResolvedValue(undefined);

        const res = await request(app)
            .put('/admin/tenants/testcorp')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send({ subscription_status: 'overdue' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.tenant.subscription_status).toBe('overdue');
    });

    it('returns 404 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        const res = await request(app)
            .put('/admin/tenants/ghost')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send({ subscription_status: 'active' });

        expect(res.status).toBe(404);
    });

    it('returns 403 without admin secret', async () => {
        const res = await request(app)
            .put('/admin/tenants/testcorp')
            .send({ subscription_status: 'active' });
        expect(res.status).toBe(403);
    });
});

// ─── DELETE /admin/tenants/:slug ──────────────────────────────────────────────

describe('DELETE /admin/tenants/:slug', () => {
    it('deletes a tenant and returns success', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        mockTenantStore.deleteTenant.mockResolvedValue(undefined);

        const res = await request(app)
            .delete('/admin/tenants/testcorp')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockTenantStore.deleteTenant).toHaveBeenCalledWith('testcorp');
    });

    it('returns 404 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        const res = await request(app)
            .delete('/admin/tenants/ghost')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(404);
    });

    it('returns 403 without admin secret', async () => {
        const res = await request(app).delete('/admin/tenants/testcorp');
        expect(res.status).toBe(403);
    });
});

// ─── GET /admin/tenants/:slug/health ─────────────────────────────────────────

describe('GET /admin/tenants/:slug/health', () => {
    it('returns ok:true with version and latency on successful Odoo connect', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        MOCK_ODOO_CLIENT.authenticate.mockResolvedValue(1);
        MOCK_ODOO_CLIENT.getVersion.mockResolvedValue(17);

        const res = await request(app)
            .get('/admin/tenants/testcorp/health')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.odoo_version).toBe(17);
        expect(res.body).toHaveProperty('latency_ms');
    });

    it('returns ok:false when Odoo authentication fails', async () => {
        mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
        MOCK_ODOO_CLIENT.authenticate.mockRejectedValue(new Error('Authentication failed'));

        const res = await request(app)
            .get('/admin/tenants/testcorp/health')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200); // health probes always return 200
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/authentication failed/i);
    });

    it('returns 404 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        const res = await request(app)
            .get('/admin/tenants/ghost/health')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(404);
    });
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

describe('GET /admin/stats', () => {
    it('returns platform-wide aggregates', async () => {
        mockTenantStore.listTenants.mockResolvedValue({
            active1: { ...SAMPLE_TENANT, subscription_status: 'active', monthly_amount: 100 },
            active2: { ...SAMPLE_TENANT, subscription_status: 'active', monthly_amount: 200 },
            overdue1: { ...SAMPLE_TENANT, subscription_status: 'overdue', monthly_amount: 50 },
            trial1: { ...SAMPLE_TENANT, subscription_status: 'trial', monthly_amount: 0 },
        });
        mockPushStore.listAllTokens.mockResolvedValue([
            { tenantId: 'active1', employeeId: 1 },
            { tenantId: 'active1', employeeId: 2 },
            { tenantId: 'active2', employeeId: 3 },
        ]);

        const res = await request(app)
            .get('/admin/stats')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(4);
        expect(res.body.active).toBe(2);
        expect(res.body.overdue).toBe(1);
        expect(res.body.trial).toBe(1);
        expect(res.body.total_push_tokens).toBe(3);
        expect(res.body.monthly_revenue).toBe(350); // 100+200+50 (overdue still counts)
        expect(Array.isArray(res.body.upcoming_renewals)).toBe(true);
    });

    it('returns 403 without admin secret', async () => {
        const res = await request(app).get('/admin/stats');
        expect(res.status).toBe(403);
    });
});

// ─── JWT protection on protected routes ───────────────────────────────────────

describe('JWT protection — edge cases', () => {
    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).get('/time-off?employee_id=1');
        expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid JWT', async () => {
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', 'Bearer invalid.token.here');
        expect(res.status).toBe(401);
    });

    it('returns 401 for an expired JWT', async () => {
        const expiredToken = jwt.sign(
            { id: 42, name: 'Test', role: 'employee', tenantId: 'testcorp' },
            TEST_JWT_SECRET,
            { expiresIn: -1 } // already expired
        );
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
    });

    it('returns 401 for a JWT signed with the wrong secret', async () => {
        const wrongToken = jwt.sign(
            { id: 42, name: 'Test', role: 'employee', tenantId: 'testcorp' },
            'wrong-secret-key'
        );
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', `Bearer ${wrongToken}`);
        expect(res.status).toBe(401);
    });

    it('returns 401 for malformed Authorization header (no token after Bearer)', async () => {
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', 'Bearer ');
        expect(res.status).toBe(401);
    });

    it('returns 401 for non-Bearer scheme', async () => {
        const token = jwt.sign({ id: 42, tenantId: 'testcorp' }, TEST_JWT_SECRET);
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', `Basic ${token}`);
        expect(res.status).toBe(401);
    });
});
