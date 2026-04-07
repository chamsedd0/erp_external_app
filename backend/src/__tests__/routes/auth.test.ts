import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { pushStore } from '../../lib/pushStore';
import { getOdooClient } from '../../odoo/client';

jest.mock('../../lib/tenantStore');
jest.mock('../../lib/pushStore');
jest.mock('../../odoo/client');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockPushStore = pushStore as jest.Mocked<typeof pushStore>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;

const TEST_JWT_SECRET = process.env.JWT_SECRET!;
const TEST_ADMIN_SECRET = process.env.ADMIN_SECRET!;

const SAMPLE_TENANT = {
    name: 'Test Corp',
    hr_email: 'hr@testcorp.com',
    odoo_url: 'https://test.odoo.com',
    odoo_db: 'testdb',
    odoo_username: 'admin@test.com',
    odoo_password: 'password',
};

const MOCK_ODOO_CLIENT = {
    authenticate: jest.fn().mockResolvedValue(1),
    searchEmployee: jest.fn(),
    searchRead: jest.fn(),
    createRecord: jest.fn(),
    writeRecord: jest.fn(),
    uploadAttachments: jest.fn(),
    getVersion: jest.fn().mockResolvedValue(16),
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
    it('returns tenant list for correct admin secret', async () => {
        mockTenantStore.listTenants.mockResolvedValue({ testcorp: SAMPLE_TENANT });

        const res = await request(app)
            .get('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('testcorp');
        // Passwords must be stripped
        expect(res.body.testcorp).not.toHaveProperty('odoo_password');
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
    };

    it('creates tenant with valid body and correct secret', async () => {
        mockTenantStore.saveTenant.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/admin/tenants')
            .set('x-admin-secret', TEST_ADMIN_SECRET)
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.slug).toBe('newco');
        expect(mockTenantStore.saveTenant).toHaveBeenCalledWith('newco', expect.objectContaining({ name: 'New Co' }));
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

// ─── JWT protection on protected routes ───────────────────────────────────────

describe('JWT protection', () => {
    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).get('/time-off?employee_id=1');
        expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid/expired token', async () => {
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', 'Bearer invalid.token.here');
        expect(res.status).toBe(401);
    });
});
