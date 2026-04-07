import { notificationStore, Notification } from '../../lib/notificationStore';
import * as redis from '../../lib/redis';

jest.mock('../../lib/redis');

const mockRedisGet = redis.redisGet as jest.MockedFunction<typeof redis.redisGet>;
const mockRedisSet = redis.redisSet as jest.MockedFunction<typeof redis.redisSet>;

function makeNotification(overrides: Partial<Notification> = {}): Notification {
    return {
        id: 'notif-1',
        employeeId: 42,
        title: 'Request Approved',
        message: 'Your leave was approved',
        type: 'request_approved',
        read: false,
        timestamp: new Date().toISOString(),
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSet.mockResolvedValue(undefined);
});

describe('notificationStore.getAll', () => {
    it('returns notifications filtered by employeeId', async () => {
        const emp42 = makeNotification({ id: 'n1', employeeId: 42 });
        const emp99 = makeNotification({ id: 'n2', employeeId: 99 });
        mockRedisGet.mockResolvedValue(JSON.stringify([emp42, emp99]));

        const result = await notificationStore.getAll('tenant-a', 42);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
    });

    it('returns empty array when Redis key does not exist', async () => {
        mockRedisGet.mockResolvedValue(null);
        const result = await notificationStore.getAll('tenant-a', 42);
        expect(result).toEqual([]);
    });

    it('returns empty array when employee has no notifications', async () => {
        const emp99 = makeNotification({ employeeId: 99 });
        mockRedisGet.mockResolvedValue(JSON.stringify([emp99]));
        const result = await notificationStore.getAll('tenant-a', 42);
        expect(result).toEqual([]);
    });

    it('uses tenant-scoped Redis key — not the global key', async () => {
        mockRedisGet.mockResolvedValue(null);
        await notificationStore.getAll('my-tenant', 1);
        expect(mockRedisGet).toHaveBeenCalledWith('shadow:t:my-tenant:notifications');
        expect(mockRedisGet).not.toHaveBeenCalledWith('shadow:notifications');
    });
});

describe('notificationStore.add', () => {
    it('appends notification to existing list', async () => {
        const existing = makeNotification({ id: 'old' });
        mockRedisGet.mockResolvedValue(JSON.stringify([existing]));

        const newNotif = makeNotification({ id: 'new' });
        await notificationStore.add('tenant-a', newNotif);

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved).toHaveLength(2);
        expect(saved[1].id).toBe('new');
    });

    it('creates list when Redis is empty', async () => {
        mockRedisGet.mockResolvedValue(null);
        await notificationStore.add('tenant-a', makeNotification({ id: 'first' }));
        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved).toHaveLength(1);
    });
});

describe('notificationStore.markRead', () => {
    it('sets read:true on matching notification', async () => {
        const notif = makeNotification({ id: 'n1', read: false });
        const other = makeNotification({ id: 'n2', read: false });
        mockRedisGet.mockResolvedValue(JSON.stringify([notif, other]));

        await notificationStore.markRead('tenant-a', 'n1');

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved.find((n: Notification) => n.id === 'n1').read).toBe(true);
        expect(saved.find((n: Notification) => n.id === 'n2').read).toBe(false);
    });

    it('is a no-op for a non-existent id (list unchanged)', async () => {
        const notif = makeNotification({ id: 'n1', read: false });
        mockRedisGet.mockResolvedValue(JSON.stringify([notif]));

        await notificationStore.markRead('tenant-a', 'does-not-exist');

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved[0].read).toBe(false);
    });
});

describe('notificationStore.markAllRead', () => {
    it('marks all notifications for the given employee as read', async () => {
        const emp42a = makeNotification({ id: 'a', employeeId: 42, read: false });
        const emp42b = makeNotification({ id: 'b', employeeId: 42, read: false });
        const emp99 = makeNotification({ id: 'c', employeeId: 99, read: false });
        mockRedisGet.mockResolvedValue(JSON.stringify([emp42a, emp42b, emp99]));

        await notificationStore.markAllRead('tenant-a', 42);

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved.find((n: Notification) => n.id === 'a').read).toBe(true);
        expect(saved.find((n: Notification) => n.id === 'b').read).toBe(true);
        expect(saved.find((n: Notification) => n.id === 'c').read).toBe(false); // different employee
    });

    it('tenant isolation: uses tenant-scoped key', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify([]));
        await notificationStore.markAllRead('tenant-xyz', 1);
        expect(mockRedisGet).toHaveBeenCalledWith('shadow:t:tenant-xyz:notifications');
        expect(mockRedisSet).toHaveBeenCalledWith('shadow:t:tenant-xyz:notifications', expect.any(String));
    });
});
