"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantStore = void 0;
exports.applyTenantDefaults = applyTenantDefaults;
exports.generateSubscriptionNumber = generateSubscriptionNumber;
exports.resolveToSlug = resolveToSlug;
const redis_1 = require("./redis");
const TENANTS_KEY = 'shadow:tenants';
const TENANT_INDEX_KEY = 'shadow:tenant_slugs';
const SUBSCRIPTION_SEQ_KEY = 'shadow:subscription_seq';
const tenantKey = (slug) => `shadow:tenant:${slug}`;
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
        max_employees: raw.max_employees ?? 0,
        enabled: raw.enabled ?? true,
        created_at: raw.created_at ?? new Date().toISOString(),
        notes: raw.notes,
        subscription_number: raw.subscription_number ?? '',
        billing_frequency: raw.billing_frequency ?? 'monthly',
    };
}
/**
 * Auto-generate the next subscription number in SP-XXXXX format.
 * Uses Redis INCR so concurrent tenant creation cannot pick the same number.
 */
async function generateSubscriptionNumber() {
    let next = await (0, redis_1.redisIncr)(SUBSCRIPTION_SEQ_KEY);
    // First run after migration: seed above the highest legacy value.
    if (next === 1) {
        const maxExisting = highestExistingSubscriptionNumber(await exports.tenantStore.listTenants());
        if (maxExisting >= next) {
            next = maxExisting + 1;
            await (0, redis_1.redisSet)(SUBSCRIPTION_SEQ_KEY, String(next));
        }
    }
    return `SP-${String(next).padStart(5, '0')}`;
}
/**
 * Resolve any external tenant code (SP-XXXXX or raw slug) to the internal slug.
 * Returns null if nothing matches.
 *
 * Resolution order:
 *   1. Direct slug match — fast path, keeps backward compat for old clients sending slugs
 *   2. subscription_number scan — for new clients sending SP-XXXXX codes
 */
async function resolveToSlug(code) {
    const all = await readAll();
    // Fast path: exact slug match (old clients, admin tooling)
    if (all[code])
        return code;
    if (all[code.trim().toLowerCase()])
        return code.trim().toLowerCase();
    // SP number path: case-insensitive scan
    const normalised = code.trim().toUpperCase();
    const match = Object.entries(all).find(([, cfg]) => cfg.subscription_number?.toUpperCase() === normalised);
    return match ? match[0] : null;
}
async function readAll() {
    const indexed = await readIndexedTenants();
    if (Object.keys(indexed).length > 0)
        return indexed;
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
function highestExistingSubscriptionNumber(all) {
    const nums = Object.values(all)
        .map(t => t.subscription_number)
        .filter(Boolean)
        .map(n => parseInt(n.replace('SP-', ''), 10))
        .filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
}
async function readIndexedTenants() {
    try {
        const slugs = await (0, redis_1.redisSMembers)(TENANT_INDEX_KEY);
        if (!slugs || slugs.length === 0)
            return {};
        const entries = await Promise.all(slugs.map(async (slug) => {
            const raw = await (0, redis_1.redisGet)(tenantKey(slug));
            if (!raw)
                return null;
            return [slug, applyTenantDefaults(JSON.parse(raw))];
        }));
        return Object.fromEntries(entries.filter(Boolean));
    }
    catch {
        return {};
    }
}
async function readLegacyRaw() {
    try {
        const raw = await (0, redis_1.redisGet)(TENANTS_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
exports.tenantStore = {
    getTenant: async (slug) => {
        try {
            const raw = await (0, redis_1.redisGet)(tenantKey(slug));
            if (raw) {
                const parsed = JSON.parse(raw);
                if ('name' in parsed || 'odoo_url' in parsed || 'subscription_status' in parsed) {
                    return applyTenantDefaults(parsed);
                }
            }
        }
        catch { /* fall through to legacy blob */ }
        const legacy = await readAll();
        return legacy[slug] ?? null;
    },
    saveTenant: async (slug, cfg) => {
        const existingRaw = await (0, redis_1.redisGet)(tenantKey(slug)).catch(() => null);
        const legacyRaw = await readLegacyRaw();
        const existing = existingRaw ? JSON.parse(existingRaw) : legacyRaw[slug];
        const next = {
            ...cfg,
            created_at: existing?.created_at ?? cfg.created_at ?? new Date().toISOString(),
        };
        await (0, redis_1.redisSet)(tenantKey(slug), JSON.stringify(next));
        await (0, redis_1.redisSAdd)(TENANT_INDEX_KEY, slug);
        // Keep the legacy blob in sync for one release so old deployments do not go blind.
        legacyRaw[slug] = next;
        await (0, redis_1.redisSet)(TENANTS_KEY, JSON.stringify(legacyRaw));
    },
    deleteTenant: async (slug) => {
        await (0, redis_1.redisDel)(tenantKey(slug));
        await (0, redis_1.redisSRem)(TENANT_INDEX_KEY, slug);
        const rawAll = await readLegacyRaw();
        delete rawAll[slug];
        await (0, redis_1.redisSet)(TENANTS_KEY, JSON.stringify(rawAll));
    },
    listTenants: async () => {
        return readAll();
    },
};
