import { redisGet, redisSet, redisDel } from './redis';

const TENANTS_KEY = 'shadow:tenants';

export interface TenantConfig {
    // ── Odoo connection ───────────────────────────────────────────────────────
    name: string;
    hr_email: string;
    odoo_url: string;
    odoo_db: string;
    odoo_username: string;
    odoo_password: string;

    // ── Primary contact ───────────────────────────────────────────────────────
    contact_name: string;
    contact_email: string;
    contact_phone?: string;

    // ── Subscription / billing ────────────────────────────────────────────────
    subscription_plan: 'starter' | 'professional' | 'enterprise';
    subscription_status: 'trial' | 'active' | 'overdue' | 'suspended' | 'cancelled';
    subscription_start: string;   // 'YYYY-MM-DD'
    subscription_renewal: string; // 'YYYY-MM-DD' — next billing date
    monthly_amount: number;       // USD/month

    // ── Admin flags ───────────────────────────────────────────────────────────
    enabled: boolean;
    created_at: string;           // ISO timestamp
    notes?: string;
}

/**
 * Apply safe defaults for any new fields that may be missing on existing tenants
 * (backwards-compatible migration).
 */
export function applyTenantDefaults(raw: Partial<TenantConfig>): TenantConfig {
    return {
        name: raw.name ?? '',
        hr_email: raw.hr_email ?? '',
        odoo_url: raw.odoo_url ?? '',
        odoo_db: raw.odoo_db ?? '',
        odoo_username: raw.odoo_username ?? '',
        odoo_password: raw.odoo_password ?? '',

        contact_name: raw.contact_name ?? '',
        contact_email: raw.contact_email ?? raw.hr_email ?? '',
        contact_phone: raw.contact_phone,

        subscription_plan: raw.subscription_plan ?? 'starter',
        subscription_status: raw.subscription_status ?? 'active',
        subscription_start: raw.subscription_start ?? new Date().toISOString().split('T')[0],
        subscription_renewal: raw.subscription_renewal ?? '',
        monthly_amount: raw.monthly_amount ?? 0,

        enabled: raw.enabled ?? true,
        created_at: raw.created_at ?? new Date().toISOString(),
        notes: raw.notes,
    };
}

async function readAll(): Promise<Record<string, TenantConfig>> {
    try {
        const raw = await redisGet(TENANTS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Partial<TenantConfig>>;
        // Normalise every entry so callers always get a fully-shaped object
        return Object.fromEntries(
            Object.entries(parsed).map(([slug, cfg]) => [slug, applyTenantDefaults(cfg)])
        );
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
        // Read raw without normalisation so we preserve existing data exactly
        let rawAll: Record<string, any> = {};
        try {
            const raw = await redisGet(TENANTS_KEY);
            if (raw) rawAll = JSON.parse(raw);
        } catch { /* ignore */ }

        // Preserve created_at if already set
        const existing = rawAll[slug] as Partial<TenantConfig> | undefined;
        rawAll[slug] = {
            ...cfg,
            created_at: existing?.created_at ?? cfg.created_at ?? new Date().toISOString(),
        };
        await redisSet(TENANTS_KEY, JSON.stringify(rawAll));
    },

    deleteTenant: async (slug: string): Promise<void> => {
        let rawAll: Record<string, any> = {};
        try {
            const raw = await redisGet(TENANTS_KEY);
            if (raw) rawAll = JSON.parse(raw);
        } catch { /* ignore */ }
        delete rawAll[slug];
        await redisSet(TENANTS_KEY, JSON.stringify(rawAll));
    },

    listTenants: async (): Promise<Record<string, TenantConfig>> => {
        return readAll();
    },
};
