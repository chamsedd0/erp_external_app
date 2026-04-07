import request from 'supertest';
import app from '../../index';
import { notificationStore } from '../../lib/notificationStore';
import { requestMonitor } from '../../lib/requestMonitor';
import { authHeader } from './helpers';

jest.mock('../../lib/notificationStore');
jest.mock('../../lib/requestMonitor');

const mockNotificationStore = notificationStore as jest.Mocked<typeof notificationStore>;
const mockRequestMonitor = requestMonitor as jest.Mocked<typeof requestMonitor>;

const SAMPLE_NOTIFICATIONS = [
    { id: 'n1', employeeId: 42, tenantId: 'testcorp', type: 'timeoff', title: 'Leave approved', body: '', read: false, timestamp: '2025-06-15T10:00:00.000Z' },
    { id: 'n2', employeeId: 42, tenantId: 'testcorp', type: 'expense', title: 'Expense submitted', body: '', read: true, timestamp: '2025-06-14T08:00:00.000Z' },
];

beforeEach(() => {
    jest.clearAllMocks();
    mockRequestMonitor.checkUpdates.mockResolvedValue(undefined);
    mockNotificationStore.getAll.mockResolvedValue([...SAMPLE_NOTIFICATIONS] as any);
    mockNotificationStore.markRead.mockResolvedValue(undefined);
    mockNotificationStore.markAllRead.mockResolvedValue(undefined);
});

// ─── GET /notifications ────────────────────────────────────────────────────────

describe('GET /notifications', () => {
    it('triggers requestMonitor.checkUpdates then returns sorted notifications', async () => {
        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        // checkUpdates called with employeeId from JWT and tenantId
        expect(mockRequestMonitor.checkUpdates).toHaveBeenCalledWith(42, 'testcorp');
        expect(mockNotificationStore.getAll).toHaveBeenCalledWith('testcorp', 42);
        // Sorted newest first
        expect(res.body.notifications[0].id).toBe('n1');
        expect(res.body.notifications[1].id).toBe('n2');
    });

    it('returns notifications sorted newest-first', async () => {
        mockNotificationStore.getAll.mockResolvedValueOnce([
            { id: 'old', timestamp: '2025-01-01T00:00:00.000Z', employeeId: 42, tenantId: 'testcorp', type: 'timeoff', title: 'Old', body: '', read: false },
            { id: 'new', timestamp: '2025-06-01T00:00:00.000Z', employeeId: 42, tenantId: 'testcorp', type: 'expense', title: 'New', body: '', read: false },
        ] as any);

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader());

        expect(res.body.notifications[0].id).toBe('new');
        expect(res.body.notifications[1].id).toBe('old');
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/notifications');
        expect(res.status).toBe(401);
    });

    it('returns 500 when requestMonitor throws', async () => {
        mockRequestMonitor.checkUpdates.mockRejectedValueOnce(new Error('Odoo unreachable'));

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader());

        expect(res.status).toBe(500);
    });

    it('returns 500 when notificationStore.getAll throws', async () => {
        mockNotificationStore.getAll.mockRejectedValueOnce(new Error('Redis down'));

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader());

        expect(res.status).toBe(500);
    });
});

// ─── PUT /notifications/:id/read ──────────────────────────────────────────────

describe('PUT /notifications/:id/read', () => {
    it('marks notification as read and returns success:true', async () => {
        const res = await request(app)
            .put('/notifications/n1/read')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockNotificationStore.markRead).toHaveBeenCalledWith('testcorp', 'n1');
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).put('/notifications/n1/read');
        expect(res.status).toBe(401);
    });

    it('returns 500 when markRead throws', async () => {
        mockNotificationStore.markRead.mockRejectedValueOnce(new Error('Redis error'));

        const res = await request(app)
            .put('/notifications/n1/read')
            .set('Authorization', authHeader());

        expect(res.status).toBe(500);
    });
});

// ─── PUT /notifications/read-all ──────────────────────────────────────────────

describe('PUT /notifications/read-all', () => {
    it('marks all notifications for the JWT employee as read', async () => {
        const res = await request(app)
            .put('/notifications/read-all')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockNotificationStore.markAllRead).toHaveBeenCalledWith('testcorp', 42);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).put('/notifications/read-all');
        expect(res.status).toBe(401);
    });

    it('returns 500 when markAllRead throws', async () => {
        mockNotificationStore.markAllRead.mockRejectedValueOnce(new Error('Redis write failed'));

        const res = await request(app)
            .put('/notifications/read-all')
            .set('Authorization', authHeader());

        expect(res.status).toBe(500);
    });

    it('uses tenantId from JWT for isolation', async () => {
        // Sign token with different tenant
        const { authHeader: ah } = await import('./helpers');
        const res = await request(app)
            .put('/notifications/read-all')
            .set('Authorization', ah({ tenantId: 'othercorp', id: 7 }));

        expect(mockNotificationStore.markAllRead).toHaveBeenCalledWith('othercorp', 7);
    });
});
