import { tenantStore, TenantConfig } from '../../lib/tenantStore';
import * as redis from '../../lib/redis';

jest.mock('../../lib/redis');

const mockRedisGet = redis.redisGet as jest.MockedFunction<typeof redis.redisGet>;
const mockRedisSet = redis.redisSet as jest.MockedFunction<typeof redis.redisSet>;

const SAMPLE_CFG: TenantConfig = {
    name: 'Acme Corp',
    hr_email: 'hr@acme.com',
    odoo_url: 'https://acme.odoo.com',
    odoo_db: 'acme',
    odoo_username: 'admin@acme.com',
    odoo_password: 'secret',
};

const SAMPLE_MAP = { acmecorp: SAMPLE_CFG };

beforeEach(() => {
    jest.clearAllMocks();
});

describe('tenantStore.getTenant', () => {
    it('returns TenantConfig when tenant exists', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify(SAMPLE_MAP));
        const result = await tenantStore.getTenant('acmecorp');
        expect(result).toEqual(SAMPLE_CFG);
        expect(mockRedisGet).toHaveBeenCalledWith('shadow:tenants');
    });

    it('returns null when tenant slug is not in map', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify(SAMPLE_MAP));
        const result = await tenantStore.getTenant('nonexistent');
        expect(result).toBeNull();
    });

    it('returns null when Redis key does not exist (null)', async () => {
        mockRedisGet.mockResolvedValue(null);
        const result = await tenantStore.getTenant('acmecorp');
        expect(result).toBeNull();
    });

    it('returns null when Redis returns invalid JSON', async () => {
        mockRedisGet.mockResolvedValue('not-json{{{');
        const result = await tenantStore.getTenant('acmecorp');
        expect(result).toBeNull();
    });

    it('returns null when Redis fetch throws', async () => {
        mockRedisGet.mockRejectedValue(new Error('Network error'));
        const result = await tenantStore.getTenant('acmecorp');
        expect(result).toBeNull();
    });
});

describe('tenantStore.saveTenant', () => {
    it('merges new tenant into existing map and saves', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify({ existing: SAMPLE_CFG }));
        mockRedisSet.mockResolvedValue(undefined);

        await tenantStore.saveTenant('newco', { ...SAMPLE_CFG, name: 'New Co' });

        expect(mockRedisSet).toHaveBeenCalledTimes(1);
        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved).toHaveProperty('existing');
        expect(saved).toHaveProperty('newco');
        expect(saved.newco.name).toBe('New Co');
    });

    it('creates a new map when Redis key is empty', async () => {
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue(undefined);

        await tenantStore.saveTenant('firstco', SAMPLE_CFG);

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(Object.keys(saved)).toHaveLength(1);
        expect(saved.firstco).toEqual(SAMPLE_CFG);
    });

    it('overwrites existing tenant with same slug', async () => {
        mockRedisGet.mockResolvedValue(JSON.stringify(SAMPLE_MAP));
        mockRedisSet.mockResolvedValue(undefined);

        const updated = { ...SAMPLE_CFG, name: 'Acme Corp v2' };
        await tenantStore.saveTenant('acmecorp', updated);

        const saved = JSON.parse((mockRedisSet.mock.calls[0] as any)[1]);
        expect(saved.acmecorp.name).toBe('Acme Corp v2');
        expect(Object.keys(saved)).toHaveLength(1);
    });
});

describe('tenantStore.listTenants', () => {
    it('returns all tenants as a record', async () => {
        const map = { a: SAMPLE_CFG, b: { ...SAMPLE_CFG, name: 'Beta' } };
        mockRedisGet.mockResolvedValue(JSON.stringify(map));
        const result = await tenantStore.listTenants();
        expect(Object.keys(result)).toHaveLength(2);
        expect(result.a.name).toBe('Acme Corp');
        expect(result.b.name).toBe('Beta');
    });

    it('returns empty object when store is empty', async () => {
        mockRedisGet.mockResolvedValue(null);
        const result = await tenantStore.listTenants();
        expect(result).toEqual({});
    });
});
