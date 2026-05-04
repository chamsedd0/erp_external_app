import { requestMonitor } from '../../lib/requestMonitor';
import { tenantStore } from '../../lib/tenantStore';
import { notificationStore } from '../../lib/notificationStore';
import { sendPushNotification } from '../../lib/pushStore';
import { getOdooClient } from '../../odoo/client';
import * as redis from '../../lib/redis';
import { SAMPLE_TENANT } from '../routes/helpers';

jest.mock('../../lib/tenantStore');
jest.mock('../../lib/notificationStore');
jest.mock('../../lib/pushStore');
jest.mock('../../odoo/client');
jest.mock('../../lib/redis');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockNotificationStore = notificationStore as jest.Mocked<typeof notificationStore>;
const mockSendPush = sendPushNotification as jest.MockedFunction<typeof sendPushNotification>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;
const mockRedisGet = redis.redisGet as jest.MockedFunction<typeof redis.redisGet>;
const mockRedisSet = redis.redisSet as jest.MockedFunction<typeof redis.redisSet>;

const TENANT_ID = 'monitor-test';
const EMPLOYEE_ID = 42;

/** Returns a fresh mock Odoo client with all methods as jest.fn() */
function makeMockClient() {
    return {
        authenticate: jest.fn().mockResolvedValue(1),
        searchRead: jest.fn(),
        createRecord: jest.fn(),
        writeRecord: jest.fn(),
        uploadAttachments: jest.fn(),
        callMethod: jest.fn(),
        getVersion: jest.fn().mockResolvedValue(16),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
    mockNotificationStore.add.mockResolvedValue(undefined);
    mockSendPush.mockResolvedValue(undefined);
    mockRedisGet.mockResolvedValue(null);        // Empty cache by default
    mockRedisSet.mockResolvedValue(undefined as any);
});

// ─── Tenant resolution ─────────────────────────────────────────────────────────

describe('requestMonitor — tenant resolution', () => {
    it('returns early without error when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);

        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
        expect(mockGetOdooClient).not.toHaveBeenCalled();
    });

    it('returns early when Odoo authentication fails', async () => {
        const client = makeMockClient();
        client.authenticate.mockRejectedValue(new Error('Auth failed'));
        mockGetOdooClient.mockReturnValue(client as any);

        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
        expect(client.searchRead).not.toHaveBeenCalled();
    });
});

// ─── First run (no cache) ─────────────────────────────────────────────────────

describe('requestMonitor — first run (no cache)', () => {
    it('saves current state to cache but does NOT emit notifications', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Annual Leave', state: 'confirm', date_from: '2026-04-20', date_to: '2026-04-21' }])  // hr.leave
            .mockResolvedValueOnce([{ id: 5, name: 'Laptop repair', state: 'draft', total_amount: 500, date: '2026-04-20', product_id: [1, 'Travel'] }])  // hr.expense
            .mockRejectedValue(new Error('Module not installed')); // helpdesk + maintenance — skip

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        // No notifications on first run
        expect(mockNotificationStore.add).not.toHaveBeenCalled();
        expect(mockSendPush).not.toHaveBeenCalled();

        // Cache must be saved
        expect(mockRedisSet).toHaveBeenCalledTimes(1);
        const cacheWritten = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(cacheWritten).toHaveProperty('time_off_1');
        expect(cacheWritten).toHaveProperty('expense_5');
    });
});

// ─── Time-off state transitions ───────────────────────────────────────────────

describe('requestMonitor — time-off state transitions', () => {
    function setupClientWithLeave(leaveState: string) {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);
        client.searchRead
            .mockResolvedValueOnce([{ id: 10, name: 'Sick Day', state: leaveState, date_from: '2026-04-20', date_to: '2026-04-20' }])
            .mockResolvedValueOnce([]) // hr.expense
            .mockRejectedValue(new Error('skip')); // helpdesk
        return client;
    }

    function setCache(leaveState: string) {
        const cache = { time_off_10: { id: 10, type: 'timeoff', state: leaveState, updated_at: new Date().toISOString() } };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));
    }

    it('generates request_approved notification when state changes confirm → validate', async () => {
        setupClientWithLeave('validate');
        setCache('confirm');

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).toHaveBeenCalledTimes(1);
        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_approved');
        expect(notif.targetType).toBe('timeoff');
        expect(notif.title).toMatch(/approved/i);
    });

    it('generates request_rejected notification when state changes confirm → refuse', async () => {
        setupClientWithLeave('refuse');
        setCache('confirm');

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).toHaveBeenCalledTimes(1);
        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_rejected');
        expect(notif.targetType).toBe('timeoff');
    });

    it('does NOT generate notification when state is unchanged', async () => {
        setupClientWithLeave('confirm');
        setCache('confirm');

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).not.toHaveBeenCalled();
    });

    it('does NOT generate notification for draft → confirm (submission, not action)', async () => {
        setupClientWithLeave('confirm');
        setCache('draft');

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).not.toHaveBeenCalled();
    });
});

// ─── Expense state transitions ────────────────────────────────────────────────

describe('requestMonitor — expense state transitions', () => {
    it('generates request_approved notification when expense approved (posted)', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([]) // hr.leave
            .mockResolvedValueOnce([{ id: 20, name: 'Business Trip', state: 'posted', total_amount: 300, date: '2026-04-15', product_id: [2, 'Travel'] }])
            .mockRejectedValue(new Error('skip')); // helpdesk + maintenance

        const cache = { expense_20: { id: 20, type: 'expense', state: 'submitted', updated_at: new Date().toISOString() } };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_approved');
        expect(notif.targetType).toBe('expense');
    });

    it('generates request_rejected notification when expense refused', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([]) // hr.leave
            .mockResolvedValueOnce([{ id: 21, name: 'Lunch', state: 'refused', total_amount: 50, date: '2026-04-10', product_id: [1, 'Meals'] }])
            .mockRejectedValue(new Error('skip'));

        const cache = { expense_21: { id: 21, type: 'expense', state: 'submitted', updated_at: new Date().toISOString() } };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_rejected');
        expect(notif.targetType).toBe('expense');
    });
});

// ─── Helpdesk stage transitions ───────────────────────────────────────────────

describe('requestMonitor — helpdesk stage transitions', () => {
    it('generates a system notification when helpdesk ticket stage changes', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([]) // hr.leave
            .mockResolvedValueOnce([]) // hr.expense
            .mockResolvedValueOnce([{ id: 42, user_id: [10, 'Alice'] }])          // hr.employee
            .mockResolvedValueOnce([{ id: 10, partner_id: [99, 'Alice Partner'] }]) // res.users
            .mockResolvedValueOnce([{ id: 30, name: 'Printer broken', stage_id: [8, 'In Progress'] }]); // helpdesk.ticket

        const cache = {
            helpdesk_30: { id: 30, type: 'helpdesk', state: '5', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.targetType).toBe('helpdesk');
        expect(notif.message).toContain('In Progress');
    });

    it('marks notification as request_approved when ticket moves to Done stage', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 42, user_id: [10, 'Alice'] }])
            .mockResolvedValueOnce([{ id: 10, partner_id: [99, 'Alice Partner'] }])
            .mockResolvedValueOnce([{ id: 31, name: 'Software install', stage_id: [9, 'Done'] }]);

        const cache = {
            helpdesk_31: { id: 31, type: 'helpdesk', state: '5', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_approved');
        expect(notif.title).toMatch(/closed/i);
    });

    it('skips helpdesk silently when module throws', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([]) // hr.leave
            .mockResolvedValueOnce([]) // hr.expense
            .mockRejectedValueOnce(new Error('Model helpdesk.ticket not found')); // helpdesk

        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
    });
});

// ─── Maintenance stage transitions ────────────────────────────────────────────

describe('requestMonitor — maintenance stage transitions', () => {
    it('generates a notification when maintenance stage changes', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([]) // hr.leave
            .mockResolvedValueOnce([]) // hr.expense
            .mockRejectedValueOnce(new Error('skip helpdesk')) // helpdesk
            .mockResolvedValueOnce([{ id: 50, name: 'Fix AC', stage_id: [3, 'In Progress'] }]); // maintenance

        const cache = {
            maintenance_50: { id: 50, type: 'maintenance', state: '1', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.targetType).toBe('maintenance');
        expect(notif.message).toContain('In Progress');
    });

    it('marks notification as request_approved when maintenance moves to Repaired', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('skip helpdesk'))
            .mockResolvedValueOnce([{ id: 51, name: 'Server fix', stage_id: [7, 'Repaired'] }]);

        const cache = {
            maintenance_51: { id: 51, type: 'maintenance', state: '2', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const notif = (mockNotificationStore.add.mock.calls[0] as any)[1];
        expect(notif.type).toBe('request_approved');
    });
});

// ─── Push notification behaviour ─────────────────────────────────────────────

describe('requestMonitor — push notifications', () => {
    it('calls sendPushNotification once per generated notification', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        // Two leaves changing state simultaneously
        client.searchRead
            .mockResolvedValueOnce([
                { id: 60, name: 'Leave A', state: 'validate', date_from: '2026-04-01', date_to: '2026-04-01' },
                { id: 61, name: 'Leave B', state: 'refuse', date_from: '2026-04-05', date_to: '2026-04-05' },
            ])
            .mockResolvedValueOnce([]) // expenses
            .mockRejectedValue(new Error('skip'));

        const cache = {
            time_off_60: { id: 60, type: 'timeoff', state: 'confirm', updated_at: new Date().toISOString() },
            time_off_61: { id: 61, type: 'timeoff', state: 'confirm', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).toHaveBeenCalledTimes(2);
        expect(mockSendPush).toHaveBeenCalledTimes(2);
    });

    it('does not crash when sendPushNotification rejects', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        client.searchRead
            .mockResolvedValueOnce([{ id: 70, name: 'Vacation', state: 'validate', date_from: '2026-04-01', date_to: '2026-04-03' }])
            .mockResolvedValueOnce([])
            .mockRejectedValue(new Error('skip'));

        const cache = {
            time_off_70: { id: 70, type: 'timeoff', state: 'confirm', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(cache));
        mockSendPush.mockRejectedValue(new Error('Push service unreachable'));

        // Should not throw
        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
    });
});

// ─── Cache preservation on partial failure ────────────────────────────────────

describe('requestMonitor — cache preservation on partial failure', () => {
    it('preserves cached entries for types that failed to fetch', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        // Expense fetch fails, but time-off succeeds
        client.searchRead
            .mockResolvedValueOnce([{ id: 80, name: 'Sick', state: 'confirm', date_from: '2026-04-01', date_to: '2026-04-01' }]) // hr.leave — ok
            .mockRejectedValueOnce(new Error('Expense fetch failed')) // hr.expense — fail
            .mockRejectedValue(new Error('skip')); // helpdesk + maintenance

        const existingExpenseCache = { expense_99: { id: 99, type: 'expense', state: 'draft', updated_at: new Date().toISOString() } };
        mockRedisGet.mockResolvedValue(JSON.stringify(existingExpenseCache));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        const writtenCache = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        // Existing expense cache entry must be preserved
        expect(writtenCache).toHaveProperty('expense_99');
        // New time_off entry must be added
        expect(writtenCache).toHaveProperty('time_off_80');
    });
});

// ─── Resilience: cache corruption & unexpected data shapes ────────────────────

describe('requestMonitor — resilience: unexpected data', () => {
    it('treats corrupt Redis JSON as empty cache and does not throw', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);
        mockRedisGet.mockResolvedValue('{this-is-not-valid-json}'); // corrupt cache

        client.searchRead
            .mockResolvedValueOnce([{ id: 1, name: 'Leave', state: 'validate', date_from: '2026-05-01', date_to: '2026-05-02' }])
            .mockResolvedValueOnce([])
            .mockRejectedValue(new Error('skip'));

        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
        // Should still save a new cache without crashing
        expect(mockRedisSet).toHaveBeenCalled();
    });

    it('handles a brand-new record not previously in cache as first-seen (no notification)', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);
        mockRedisGet.mockResolvedValue(null); // no cache at all

        client.searchRead
            .mockResolvedValueOnce([
                { id: 999, name: 'Brand new leave', state: 'validate', date_from: '2026-06-01', date_to: '2026-06-02' },
            ])
            .mockResolvedValueOnce([])
            .mockRejectedValue(new Error('skip'));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        // First run — no notifications should be emitted
        expect(mockNotificationStore.add).not.toHaveBeenCalled();
        expect(mockSendPush).not.toHaveBeenCalled();
    });

    it('fires notification for BOTH records when two requests change state simultaneously', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);

        const oldCache = {
            time_off_1: { id: 1, type: 'timeoff', state: 'confirm', updated_at: new Date().toISOString() },
            time_off_2: { id: 2, type: 'timeoff', state: 'confirm', updated_at: new Date().toISOString() },
        };
        mockRedisGet.mockResolvedValue(JSON.stringify(oldCache));

        client.searchRead
            .mockResolvedValueOnce([
                { id: 1, name: 'Leave 1', state: 'validate', date_from: '2026-05-01', date_to: '2026-05-02' },
                { id: 2, name: 'Leave 2', state: 'refuse', date_from: '2026-05-03', date_to: '2026-05-04' },
            ])
            .mockResolvedValueOnce([])
            .mockRejectedValue(new Error('skip'));

        await requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID);

        expect(mockNotificationStore.add).toHaveBeenCalledTimes(2);
        const types = (mockNotificationStore.add as jest.Mock).mock.calls.map((c: any) => c[1].type);
        expect(types).toContain('request_approved');
        expect(types).toContain('request_rejected');
    });

    it('handles stage_id as null on helpdesk record without crashing', async () => {
        const client = makeMockClient();
        mockGetOdooClient.mockReturnValue(client as any);
        mockRedisGet.mockResolvedValue(null);

        client.searchRead
            .mockResolvedValueOnce([]) // time_off empty
            .mockResolvedValueOnce([]) // expense empty
            .mockResolvedValueOnce([   // helpdesk with null stage_id
                { id: 10, name: 'Ticket', stage_id: null },
            ])
            .mockResolvedValueOnce([]); // maintenance

        await expect(requestMonitor.checkUpdates(EMPLOYEE_ID, TENANT_ID)).resolves.toBeUndefined();
        // Should cache without crashing
        expect(mockRedisSet).toHaveBeenCalled();
    });
});
