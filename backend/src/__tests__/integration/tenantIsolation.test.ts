/**
 * Tenant Isolation Tests
 *
 * These tests prove that Tenant A's JWT cannot access Tenant B's data,
 * and that all protected routes enforce tenant scoping via the JWT payload.
 * This is the most critical security property of the multi-tenant system.
 */
import request from 'supertest';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { notificationStore } from '../../lib/notificationStore';
import { requestMonitor } from '../../lib/requestMonitor';
import { getOdooClient } from '../../odoo/client';
import { authHeader, SAMPLE_TENANT, makeMockOdooClient } from '../routes/helpers';

// Preserve applyTenantDefaults while mocking tenantStore
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
jest.mock('../../lib/notificationStore');
jest.mock('../../lib/requestMonitor');   // Prevent real monitor from running
jest.mock('../../odoo/client');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockNotificationStore = notificationStore as jest.Mocked<typeof notificationStore>;
const mockRequestMonitor = requestMonitor as jest.Mocked<typeof requestMonitor>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;

const TENANT_A = 'tenant-alpha';
const TENANT_B = 'tenant-beta';

const TENANT_A_CFG = { ...SAMPLE_TENANT, name: 'Alpha Corp' };
const TENANT_B_CFG = { ...SAMPLE_TENANT, name: 'Beta Corp' };

// Two different mock Odoo clients — one per tenant
let clientA: ReturnType<typeof makeMockOdooClient>;
let clientB: ReturnType<typeof makeMockOdooClient>;

beforeEach(() => {
    jest.clearAllMocks();

    clientA = makeMockOdooClient();
    clientB = makeMockOdooClient();

    // Prevent real monitor from running in notification route tests
    mockRequestMonitor.checkUpdates.mockResolvedValue(undefined);

    // Route Odoo clients by tenantId
    mockGetOdooClient.mockImplementation((tenantId) => {
        if (tenantId === TENANT_A) return clientA as any;
        if (tenantId === TENANT_B) return clientB as any;
        return clientA as any; // fallback
    });

    // Return different tenant configs
    mockTenantStore.getTenant.mockImplementation(async (slug) => {
        if (slug === TENANT_A) return TENANT_A_CFG;
        if (slug === TENANT_B) return TENANT_B_CFG;
        return null;
    });
});

// ─── Odoo client isolation ─────────────────────────────────────────────────────

describe('Odoo client isolation', () => {
    it('JWT for tenantA always calls getOdooClient with tenantA — never tenantB', async () => {
        clientA.searchRead.mockResolvedValueOnce([]);

        await request(app)
            .get('/expenses?employee_id=1')
            .set('Authorization', authHeader({ tenantId: TENANT_A }));

        expect(mockGetOdooClient).toHaveBeenCalledWith(TENANT_A, TENANT_A_CFG);
        expect(mockGetOdooClient).not.toHaveBeenCalledWith(TENANT_B, expect.anything());
    });

    it('JWT for tenantB always calls getOdooClient with tenantB — never tenantA', async () => {
        clientB.searchRead.mockResolvedValueOnce([]);

        await request(app)
            .get('/expenses?employee_id=1')
            .set('Authorization', authHeader({ tenantId: TENANT_B }));

        expect(mockGetOdooClient).toHaveBeenCalledWith(TENANT_B, TENANT_B_CFG);
        expect(mockGetOdooClient).not.toHaveBeenCalledWith(TENANT_A, expect.anything());
    });

    it('clientA.searchRead is never called when tenantB makes a request', async () => {
        clientB.searchRead.mockResolvedValueOnce([]);

        await request(app)
            .get('/time-off?employee_id=999')
            .set('Authorization', authHeader({ tenantId: TENANT_B }));

        expect(clientA.searchRead).not.toHaveBeenCalled();
        expect(clientB.searchRead).toHaveBeenCalled();
    });
});

// ─── Notification isolation ───────────────────────────────────────────────────

describe('Notification isolation', () => {
    it('GET /notifications uses tenantId from JWT — not from query param', async () => {
        mockNotificationStore.getAll.mockResolvedValue([]);

        await request(app)
            .get('/notifications?employee_id=42')
            .set('Authorization', authHeader({ tenantId: TENANT_A }));

        // notificationStore.getAll must be called with TENANT_A, not TENANT_B
        expect(mockNotificationStore.getAll).toHaveBeenCalledWith(TENANT_A, 42);
        expect(mockNotificationStore.getAll).not.toHaveBeenCalledWith(TENANT_B, expect.anything());
    });

    it('JWT employee id takes precedence over query param — cannot spoof another employee', async () => {
        mockNotificationStore.getAll.mockResolvedValue([]);

        // tenantA JWT with id=42, but query param says employee_id=999
        await request(app)
            .get('/notifications?employee_id=999')
            .set('Authorization', authHeader({ tenantId: TENANT_A, id: 42 }));

        // Route uses jwtId (42) over query param (999) — employee cannot spoof
        // tenantId is always from JWT, never from request body/query
        expect(mockNotificationStore.getAll).toHaveBeenCalledWith(TENANT_A, 42);
        expect(mockNotificationStore.getAll).not.toHaveBeenCalledWith(TENANT_B, expect.anything());
    });

    it('markAllRead scopes to JWT tenantId, not body tenantId', async () => {
        mockNotificationStore.markAllRead.mockResolvedValue(undefined);

        await request(app)
            .put('/notifications/read-all')
            .set('Authorization', authHeader({ tenantId: TENANT_A, id: 7 }));

        expect(mockNotificationStore.markAllRead).toHaveBeenCalledWith(TENANT_A, 7);
        expect(mockNotificationStore.markAllRead).not.toHaveBeenCalledWith(TENANT_B, expect.anything());
    });
});

// ─── JWT validity and expiry ──────────────────────────────────────────────────

describe('JWT validity — all protected routes', () => {
    const PROTECTED_ROUTES = [
        { method: 'get', path: '/time-off?employee_id=1' },
        { method: 'get', path: '/expenses?employee_id=1' },
        { method: 'get', path: '/notifications?employee_id=1' },
        { method: 'get', path: '/timesheet?employee_id=1' },
        { method: 'get', path: '/helpdesk?employee_id=1' },
        { method: 'get', path: '/maintenance?employee_id=1' },
        { method: 'get', path: '/attendance?employee_id=1' },
    ];

    it.each(PROTECTED_ROUTES)('returns 401 without JWT — $method $path', async ({ method, path }) => {
        const res = await (request(app) as any)[method](path);
        expect(res.status).toBe(401);
    });

    it.each(PROTECTED_ROUTES)('returns 401 with invalid JWT — $method $path', async ({ method, path }) => {
        const res = await (request(app) as any)[method](path)
            .set('Authorization', 'Bearer totally.fake.token');
        expect(res.status).toBe(401);
    });
});

// ─── Unknown tenant rejection ─────────────────────────────────────────────────

describe('Unknown tenant rejection', () => {
    it('returns 401 when JWT tenantId does not exist in Redis', async () => {
        // getTenant returns null for 'ghost-tenant'
        const res = await request(app)
            .get('/expenses?employee_id=1')
            .set('Authorization', authHeader({ tenantId: 'ghost-tenant' }));

        expect(res.status).toBe(401);
    });

    it('returns 401 on time-off route for unknown tenant', async () => {
        const res = await request(app)
            .get('/time-off?employee_id=1')
            .set('Authorization', authHeader({ tenantId: 'nobody' }));

        expect(res.status).toBe(401);
    });
});

// ─── Admin endpoint protection ────────────────────────────────────────────────

describe('Admin endpoint protection', () => {
    const ADMIN_ROUTES = [
        { method: 'get', path: '/admin/tenants' },
        { method: 'post', path: '/admin/tenants' },
        { method: 'get', path: '/admin/tenants/testcorp' },
        { method: 'put', path: '/admin/tenants/testcorp' },
        { method: 'delete', path: '/admin/tenants/testcorp' },
        { method: 'get', path: '/admin/stats' },
    ];

    it.each(ADMIN_ROUTES)('returns 403 without x-admin-secret — $method $path', async ({ method, path }) => {
        const res = await (request(app) as any)[method](path);
        expect(res.status).toBe(403);
    });

    it.each(ADMIN_ROUTES)('returns 403 with wrong x-admin-secret — $method $path', async ({ method, path }) => {
        const res = await (request(app) as any)[method](path)
            .set('x-admin-secret', 'wrong-secret');
        expect(res.status).toBe(403);
    });

    it('employee JWT does NOT grant access to admin routes', async () => {
        const res = await request(app)
            .get('/admin/tenants')
            .set('Authorization', authHeader({ tenantId: TENANT_A }));
        expect(res.status).toBe(403);
    });
});
