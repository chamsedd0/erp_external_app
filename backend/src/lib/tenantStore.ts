import { redisGet, redisSet } from './redis';

const TENANTS_KEY = 'shadow:tenants';

export interface TenantConfig {
    name: string;
    hr_email: string;
    odoo_url: string;
    odoo_db: string;
    odoo_username: string;
    odoo_password: string;
}

async function readAll(): Promise<Record<string, TenantConfig>> {
    try {
        const raw = await redisGet(TENANTS_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, TenantConfig>;
    } catch {
        return {};
    }
}

export const tenantStore = {
    getTenant: async (slug: string): Promise<TenantConfig | null> => {
        const all = await readAll();
        return all[slug] ?? null;
    },

    saveTenant: async (slug: string, cfg: TenantConfig): Promise<void> => {
        const all = await readAll();
        all[slug] = cfg;
        await redisSet(TENANTS_KEY, JSON.stringify(all));
    },

    listTenants: async (): Promise<Record<string, TenantConfig>> => {
        return readAll();
    },
};
