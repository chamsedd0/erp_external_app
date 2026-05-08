"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const pushStore_1 = require("../lib/pushStore");
const notificationStore_1 = require("../lib/notificationStore");
const redis_1 = require("../lib/redis");
// ── Auth routes ───────────────────────────────────────────────────────────────
const authRouter = (0, express_1.Router)();
exports.authRouter = authRouter;
const loginSchema = zod_1.z.object({
    employee_id: zod_1.z.string(),
    pin: zod_1.z.string(),
    tenant_slug: zod_1.z.string(),
});
authRouter.post('/login', async (req, res) => {
    try {
        const { employee_id, pin, tenant_slug } = loginSchema.parse(req.body);
        // 1. Look up tenant
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenant_slug);
        if (!tenantConfig) {
            return res.status(401).json({ error: 'Unknown company code' });
        }
        // Reject login if tenant is disabled / suspended / cancelled
        if (!tenantConfig.enabled || tenantConfig.subscription_status === 'suspended' || tenantConfig.subscription_status === 'cancelled') {
            return res.status(403).json({ error: 'Account access is currently disabled. Please contact your administrator.' });
        }
        const client = (0, client_1.getOdooClient)(tenant_slug, tenantConfig);
        // 2. Authenticate Admin to get UID
        const uid = await client.authenticate();
        // 3. Search for Employee
        const employees = await client.searchEmployee(uid, employee_id, pin);
        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const employee = employees[0];
        // 4. Generate JWT (includes tenantId)
        const token = jsonwebtoken_1.default.sign({
            id: employee.id,
            name: employee.name,
            role: 'employee',
            tenantId: tenant_slug,
        }, config_1.config.jwtSecret, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                department: employee.department_id ? employee.department_id[1] : null,
                job_title: employee.job_title,
                work_email: employee.work_email,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/** GET /auth/tenant/:slug — public, returns display info only (no credentials) */
authRouter.get('/tenant/:slug', async (req, res) => {
    const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
    if (!cfg)
        return res.status(404).json({ error: 'Company not found' });
    res.json({ name: cfg.name, hr_email: cfg.hr_email });
});
// ── Push Notification Token Management ───────────────────────────────────────
const pushTokenSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    token: zod_1.z.string().min(1),
    tenant_slug: zod_1.z.string(),
});
/**
 * POST /auth/push-token
 * Saves an Expo push token for the given employee.
 * Called from the frontend after the user grants notification permission.
 */
authRouter.post('/push-token', async (req, res) => {
    try {
        const { employee_id, token, tenant_slug } = pushTokenSchema.parse(req.body);
        await pushStore_1.pushStore.saveToken(tenant_slug, employee_id, token);
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Save Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * DELETE /auth/push-token
 * Removes the Expo push token for the given employee.
 * Called on logout so the device no longer receives notifications.
 */
authRouter.delete('/push-token', async (req, res) => {
    try {
        const employeeId = req.body?.employee_id ?? req.query?.employee_id;
        const tenantSlug = req.body?.tenant_slug ?? req.query?.tenant_slug;
        if (!employeeId || !tenantSlug) {
            return res.status(400).json({ error: 'employee_id and tenant_slug are required' });
        }
        await pushStore_1.pushStore.removeToken(String(tenantSlug), parseInt(String(employeeId)));
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ── Admin routes ──────────────────────────────────────────────────────────────
const adminRouter = (0, express_1.Router)();
exports.adminRouter = adminRouter;
/** Full schema for creating or replacing a tenant (all fields) */
const tenantBodySchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    hr_email: zod_1.z.string().email(),
    odoo_url: zod_1.z.string().url(),
    odoo_db: zod_1.z.string().min(1),
    odoo_username: zod_1.z.string().min(1),
    odoo_password: zod_1.z.string().min(1),
    contact_name: zod_1.z.string().default(''),
    contact_email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    contact_phone: zod_1.z.string().optional(),
    subscription_plan: zod_1.z.enum(['starter', 'professional', 'enterprise']).default('starter'),
    subscription_status: zod_1.z.enum(['trial', 'active', 'overdue', 'suspended', 'cancelled']).default('active'),
    subscription_start: zod_1.z.string().default(() => new Date().toISOString().split('T')[0]),
    subscription_renewal: zod_1.z.string().default(''),
    monthly_amount: zod_1.z.number().min(0).default(0),
    enabled: zod_1.z.boolean().default(true),
    notes: zod_1.z.string().optional(),
});
/** Partial schema for PUT (all fields optional except slug comes from params) */
const tenantUpdateSchema = tenantBodySchema.omit({ slug: true }).partial();
/** Strip credentials from a tenant record before returning to the admin UI */
function safeTenant(slug, cfg) {
    const { odoo_password, odoo_username, ...safe } = cfg;
    return { slug, ...safe };
}
// ── POST /admin/tenants — register or update a tenant ─────────────────────────
adminRouter.post('/tenants', async (req, res) => {
    try {
        const { slug, ...fields } = tenantBodySchema.parse(req.body);
        const existing = await tenantStore_1.tenantStore.getTenant(slug);
        const cfg = (0, tenantStore_1.applyTenantDefaults)({
            ...existing,
            ...fields,
            created_at: existing?.created_at ?? new Date().toISOString(),
        });
        await tenantStore_1.tenantStore.saveTenant(slug, cfg);
        res.json({ success: true, slug });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues ?? error.errors });
        }
        console.error('Save Tenant Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants — list all tenants ─────────────────────────────────────
adminRouter.get('/tenants', async (_req, res) => {
    try {
        const tenants = await tenantStore_1.tenantStore.listTenants();
        const safe = Object.entries(tenants).map(([slug, cfg]) => safeTenant(slug, cfg));
        res.json(safe);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants/:slug — single tenant detail ───────────────────────────
adminRouter.get('/tenants/:slug', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        res.json(safeTenant(req.params.slug, cfg));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── PUT /admin/tenants/:slug — update a tenant ────────────────────────────────
adminRouter.put('/tenants/:slug', async (req, res) => {
    try {
        const existing = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!existing)
            return res.status(404).json({ error: 'Tenant not found' });
        const updates = tenantUpdateSchema.parse(req.body);
        const merged = (0, tenantStore_1.applyTenantDefaults)({ ...existing, ...updates });
        await tenantStore_1.tenantStore.saveTenant(req.params.slug, merged);
        res.json({ success: true, tenant: safeTenant(req.params.slug, merged) });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues ?? error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// ── DELETE /admin/tenants/:slug — remove a tenant ─────────────────────────────
adminRouter.delete('/tenants/:slug', async (req, res) => {
    try {
        const existing = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!existing)
            return res.status(404).json({ error: 'Tenant not found' });
        await tenantStore_1.tenantStore.deleteTenant(req.params.slug);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants/:slug/health — probe Odoo connectivity ─────────────────
adminRouter.get('/tenants/:slug/health', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const client = (0, client_1.getOdooClient)(req.params.slug, cfg);
        const start = Date.now();
        try {
            const uid = await client.authenticate();
            const version = await client.getVersion().catch(() => null);
            res.json({ ok: true, odoo_version: version, latency_ms: Date.now() - start, uid });
        }
        catch (odooErr) {
            res.json({ ok: false, error: odooErr?.message ?? 'Connection failed', latency_ms: Date.now() - start });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants/:slug/stats — per-tenant metrics ──────────────────────
adminRouter.get('/tenants/:slug/stats', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const slug = req.params.slug;
        // Count push tokens (active devices)
        const allTokens = await pushStore_1.pushStore.listAllTokens().catch(() => []);
        const active_devices = allTokens.filter(t => t.tenantId === slug).length;
        // Count notifications
        const notifKey = `shadow:t:${slug}:notifications`;
        let notifications = [];
        try {
            const raw = await (0, redis_1.redisGet)(notifKey);
            notifications = raw ? JSON.parse(raw) : [];
        }
        catch { /* ignore */ }
        const notifications_total = notifications.length;
        const notifications_unread = notifications.filter((n) => !n.read).length;
        // Last sync: find the newest updatedAt in request cache keys for this tenant
        let last_sync = null;
        try {
            const cacheKeys = await (0, redis_1.redisScan)(`shadow:t:${slug}:req_cache:*`);
            if (cacheKeys.length > 0) {
                const times = [];
                for (const key of cacheKeys.slice(0, 20)) { // sample up to 20
                    const raw = await (0, redis_1.redisGet)(key).catch(() => null);
                    if (!raw)
                        continue;
                    const cache = JSON.parse(raw);
                    for (const entry of Object.values(cache)) {
                        if (entry.updated_at)
                            times.push(new Date(entry.updated_at).getTime());
                    }
                }
                if (times.length > 0)
                    last_sync = new Date(Math.max(...times)).toISOString();
            }
        }
        catch { /* ignore */ }
        res.json({ active_devices, notifications_total, notifications_unread, last_sync });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants/:slug/devices — list registered push token devices ─────
adminRouter.get('/tenants/:slug/devices', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const devices = await pushStore_1.pushStore.listDevicesForTenant(req.params.slug);
        res.json(devices);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/tenants/:slug/notifications — paginated notification history ───
adminRouter.get('/tenants/:slug/notifications', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
        const offset = parseInt(String(req.query.offset ?? '0'), 10);
        const result = await notificationStore_1.notificationStore.listAllForTenant(req.params.slug, limit, offset);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── GET /admin/stats — platform-wide metrics ──────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
    try {
        const tenants = await tenantStore_1.tenantStore.listTenants();
        const slugs = Object.keys(tenants);
        const cfgs = Object.values(tenants);
        const total = slugs.length;
        const active = cfgs.filter(t => t.subscription_status === 'active' && t.enabled).length;
        const overdue = cfgs.filter(t => t.subscription_status === 'overdue').length;
        const suspended = cfgs.filter(t => t.subscription_status === 'suspended').length;
        const trial = cfgs.filter(t => t.subscription_status === 'trial').length;
        const allTokens = await pushStore_1.pushStore.listAllTokens().catch(() => []);
        const total_push_tokens = allTokens.length;
        const monthly_revenue = cfgs
            .filter(t => t.enabled && ['active', 'overdue'].includes(t.subscription_status))
            .reduce((sum, t) => sum + (t.monthly_amount ?? 0), 0);
        // Renewals in next 30 days
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const upcoming_renewals = slugs
            .filter(slug => {
            const r = tenants[slug].subscription_renewal;
            if (!r)
                return false;
            const d = new Date(r);
            return d >= now && d <= in30;
        })
            .map(slug => ({ slug, name: tenants[slug].name, renewal: tenants[slug].subscription_renewal }));
        res.json({
            total,
            active,
            overdue,
            suspended,
            trial,
            total_push_tokens,
            monthly_revenue,
            upcoming_renewals,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
