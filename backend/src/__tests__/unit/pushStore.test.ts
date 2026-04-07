import { pushStore, sendPushNotification } from '../../lib/pushStore';
import * as redis from '../../lib/redis';

jest.mock('../../lib/redis');

const mockRedisGet = redis.redisGet as jest.MockedFunction<typeof redis.redisGet>;
const mockRedisSet = redis.redisSet as jest.MockedFunction<typeof redis.redisSet>;
const mockRedisDel = redis.redisDel as jest.MockedFunction<typeof redis.redisDel>;

beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSet.mockResolvedValue(undefined);
    mockRedisDel.mockResolvedValue(undefined);
});

describe('pushStore.saveToken', () => {
    it('saves token at tenant-scoped key', async () => {
        await pushStore.saveToken('tenant-a', 42, 'ExponentPushToken[abc123]');
        expect(mockRedisSet).toHaveBeenCalledWith(
            'shadow:t:tenant-a:push_token:42',
            expect.stringContaining('ExponentPushToken[abc123]')
        );
    });

    it('different tenants with same empId write to different keys', async () => {
        await pushStore.saveToken('tenant-a', 1, 'token-a');
        await pushStore.saveToken('tenant-b', 1, 'token-b');
        const keys = mockRedisSet.mock.calls.map((c: any) => c[0]);
        expect(keys[0]).toBe('shadow:t:tenant-a:push_token:1');
        expect(keys[1]).toBe('shadow:t:tenant-b:push_token:1');
    });
});

describe('pushStore.getToken', () => {
    it('returns token string when present', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify({
            employeeId: 42, token: 'ExponentPushToken[xyz]', updatedAt: new Date().toISOString(),
        }));
        const token = await pushStore.getToken('tenant-a', 42);
        expect(token).toBe('ExponentPushToken[xyz]');
    });

    it('returns null when key does not exist', async () => {
        mockRedisGet.mockResolvedValue(null);
        const token = await pushStore.getToken('tenant-a', 42);
        expect(token).toBeNull();
    });

    it('returns null on parse error', async () => {
        mockRedisGet.mockResolvedValue('invalid-json{{');
        const token = await pushStore.getToken('tenant-a', 42);
        expect(token).toBeNull();
    });
});

describe('pushStore.removeToken', () => {
    it('calls redisDel with tenant-scoped key', async () => {
        await pushStore.removeToken('tenant-a', 42);
        expect(mockRedisDel).toHaveBeenCalledWith('shadow:t:tenant-a:push_token:42');
    });
});

describe('sendPushNotification', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
        global.fetch = mockFetch;
    });

    afterEach(() => {
        // Restore the default no-op fetch from setup.ts
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: null }), text: async () => '' }) as any;
    });

    it('does nothing when no token is stored for the employee', async () => {
        mockRedisGet.mockResolvedValue(null);
        await sendPushNotification('tenant-a', 42, { title: 'Test', body: 'Hello' });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls the Expo push API when a token exists', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify({
            employeeId: 42, token: 'ExponentPushToken[TEST]', updatedAt: new Date().toISOString(),
        }));
        mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

        await sendPushNotification('tenant-a', 42, { title: 'Approved', body: 'Your leave was approved' });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://exp.host/--/api/v2/push/send',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('ExponentPushToken[TEST]'),
            })
        );
    });

    it('does not throw when the Expo API returns an error', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify({
            employeeId: 1, token: 'ExponentPushToken[X]', updatedAt: '',
        }));
        mockFetch.mockResolvedValue({ ok: false, text: async () => 'Bad Request' });

        await expect(sendPushNotification('tenant-a', 1, { title: 'T', body: 'B' })).resolves.not.toThrow();
    });

    it('does not throw when fetch itself throws (network error)', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify({
            employeeId: 1, token: 'ExponentPushToken[X]', updatedAt: '',
        }));
        mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
        await expect(sendPushNotification('tenant-a', 1, { title: 'T', body: 'B' })).resolves.not.toThrow();
    });
});
