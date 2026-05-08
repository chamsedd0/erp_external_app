"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantStore = void 0;
exports.applyTenantDefaults = applyTenantDefaults;
const redis_1 = require("./redis");
const TENANTS_KEY = 'shadow:tenants';
/**
 * Apply safe defaults for any new fields that may be missing on existing tenants
 * (backwards-compatible migration).
 */
function applyTenantDefaults(raw) {
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
async function readAll() {
    try {
        const raw = await (0, redis_1.redisGet)(TENANTS_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        // Normalise every entry so callers always get a fully-shaped object
        return Object.fromEntries(Object.entries(parsed).map(([slug, cfg]) => [slug, applyTenantDefaults(cfg)]));
    }
    catch {
        return {};
    }
}
exports.tenantStore = {
    getTenant: async (slug) => {
        const all = await readAll();
        return all[slug] ?? null;
    },
    saveTenant: async (slug, cfg) => {
        // Read raw without normalisation so we preserve existing data exactly
        let rawAll = {};
        try {
            const raw = await (0, redis_1.redisGet)(TENANTS_KEY);
            if (raw)
                rawAll = JSON.parse(raw);
        }
        catch { /* ignore */ }
        // Preserve created_at if already set
        const existing = rawAll[slug];
        rawAll[slug] = {
            ...cfg,
            created_at: existing?.created_at ?? cfg.created_at ?? new Date().toISOString(),
        };
        await (0, redis_1.redisSet)(TENANTS_KEY, JSON.stringify(rawAll));
    },
    deleteTenant: async (slug) => {
        let rawAll = {};
        try {
            const raw = await (0, redis_1.redisGet)(TENANTS_KEY);
            if (raw)
                rawAll = JSON.parse(raw);
        }
        catch { /* ignore */ }
        delete rawAll[slug];
        await (0, redis_1.redisSet)(TENANTS_KEY, JSON.stringify(rawAll));
    },
    listTenants: async () => {
        return readAll();
    },
};
