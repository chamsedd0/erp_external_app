import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getOdooClient } from '../odoo/client';
import { tenantStore, TenantConfig, applyTenantDefaults, generateSubscriptionNumber, resolveToSlug } from '../lib/tenantStore';
import { pushStore } from '../lib/pushStore';
import { notificationStore } from '../lib/notificationStore';
import { planStore, SubscriptionPlan } from '../lib/planStore';
import { getErrors, clearErrors } from '../lib/errorLog';
import { generateInvoiceHTML } from '../lib/invoiceTemplate';
import { redisGet, redisScan } from '../lib/redis';

// ── Auth routes ───────────────────────────────────────────────────────────────

const authRouter = Router();

const loginSchema = z.object({
    employee_id: z.string(),
    pin: z.string(),
    tenant_slug: z.string().optional(),
    tenant_subscription_number: z.string().optional(),
}).refine(d => d.tenant_slug || d.tenant_subscription_number, {
    message: 'tenant_slug or tenant_subscription_number is required',
});

authRouter.post('/login', async (req, res) => {
    try {
        const body = loginSchema.parse(req.body);

        // 1. Resolve tenant — accepts SP number (SP-XXXXX) or slug for backward compat
        const rawCode = body.tenant_slug ?? body.tenant_subscription_number!;
        const tenantId = await resolveToSlug(rawCode);
        if (!tenantId) return res.status(401).json({ error: 'Unknown company code' });

        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) {
            return res.status(401).json({ error: 'Unknown company code' });
        }

        // 2. Reject login if tenant is disabled / suspended / cancelled
        if (
            !tenantConfig.enabled ||
            tenantConfig.subscription_status === 'suspended' ||
            tenantConfig.subscription_status === 'cancelled'
        ) {
            return res.status(403).json({ error: 'Account access is currently disabled. Please contact your administrator.' });
        }

        // 3. Max employee check — based on plan's max_employees
        const plan = await planStore.getPlan(tenantConfig.subscription_plan).catch(() => null);
        const maxEmployees = plan?.max_employees ?? { starter: 10, professional: 50, enterprise: 0 }[tenantConfig.subscription_plan] ?? 10;

        if (maxEmployees > 0) {
            const empId = parseInt(body.employee_id, 10);
            const existingToken = !isNaN(empId) ? await pushStore.getToken(tenantId, empId).catch(() => null) : null;
            if (!existingToken) {
                // Employee has no registered device — count existing unique employees
                const devices = await pushStore.listDevicesForTenant(tenantId).catch(() => []);
                if (devices.length >= maxEmployees) {
                    return res.status(403).json({
                        error: 'Employee limit reached for this subscription plan. Contact your administrator.',
                    });
                }
            }
        }

        const client = getOdooClient(tenantId, tenantConfig);

        // 4. Authenticate Admin to get UID
        const uid = await client.authenticate();

        // 5. Search for Employee
        const employees: any = await client.searchEmployee(uid, body.employee_id, body.pin);

        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const employee = employees[0];

        // 6. Generate JWT (includes tenantId)
        const token = jwt.sign(
            {
                id: employee.id,
                name: employee.name,
                role: 'employee',
                tenantId,
            },
            config.jwtSecret,
            { expiresIn: '7d' }
        );

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

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/** GET /auth/tenant/:code — public, returns display info only (no credentials).
 *  Accepts SP number (SP-XXXXX) or slug. Returns subscription_number — never the slug. */
authRouter.get('/tenant/:code', async (req, res) => {
    const slug = await resolveToSlug(req.params.code);
    if (!slug) return res.status(404).json({ error: 'Company not found' });
    const cfg = await tenantStore.getTenant(slug);
    if (!cfg) return res.status(404).json({ error: 'Company not found' });
    res.json({
        name: cfg.name,
        hr_email: cfg.hr_email,
        // Return the SP number so the mobile app stores it — never expose the internal slug
        subscription_number: cfg.subscription_number || req.params.code.toUpperCase(),
    });
});

// ── Push Notification Token Management ───────────────────────────────────────

// Accepts SP number (tenant_code) or legacy tenant_slug for backward compat
const pushTokenSchema = z.object({
    employee_id: z.number(),
    token: z.string().min(1),
    tenant_code: z.string().optional(),                // preferred: SP number
    tenant_subscription_number: z.string().optional(), // alias
    tenant_slug: z.string().optional(),                // backward compat (old app versions)
}).refine(
    d => d.tenant_code || d.tenant_subscription_number || d.tenant_slug,
    { message: 'tenant_code, tenant_subscription_number, or tenant_slug is required' }
);

/**
 * POST /auth/push-token
 * Saves an Expo push token for the given employee.
 * Called from the frontend after the user grants notification permission.
 */
authRouter.post('/push-token', async (req, res) => {
    try {
        const body = pushTokenSchema.parse(req.body);
        const rawCode = body.tenant_code ?? body.tenant_subscription_number ?? body.tenant_slug!;
        const slug = await resolveToSlug(rawCode);
        if (!slug) return res.status(400).json({ error: 'Unknown company code' });
        await pushStore.saveToken(slug, body.employee_id, body.token);
        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
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
        const rawCode =
            req.body?.tenant_code ?? req.body?.tenant_subscription_number ?? req.body?.tenant_slug ??
            req.query?.tenant_code ?? req.query?.tenant_slug;
        if (!employeeId || !rawCode) {
            return res.status(400).json({ error: 'employee_id and tenant identifier are required' });
        }
        const slug = await resolveToSlug(String(rawCode));
        if (!slug) return res.status(400).json({ error: 'Unknown company code' });
        await pushStore.removeToken(slug, parseInt(String(employeeId)));
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

const adminRouter = Router();

/** Full schema for creating or replacing a tenant (all fields) */
const tenantBodySchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    hr_email: z.string().email(),
    odoo_url: z.string().url(),
    odoo_db: z.string().min(1),
    odoo_username: z.string().min(1),
    odoo_password: z.string().min(1),

    contact_name: z.string().default(''),
    contact_email: z.string().email().optional().or(z.literal('')),
    contact_phone: z.string().optional(),

    subscription_plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
    subscription_status: z.enum(['trial', 'active', 'overdue', 'suspended', 'cancelled']).default('active'),
    subscription_start: z.string().default(() => new Date().toISOString().split('T')[0]),
    subscription_renewal: z.string().default(''),
    monthly_amount: z.number().min(0).default(0),
    billing_frequency: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),

    enabled: z.boolean().default(true),
    notes: z.string().optional(),
    subscription_number: z.string().optional(),
});

/** Partial schema for PUT (all fields optional except slug comes from params) */
const tenantUpdateSchema = tenantBodySchema.omit({ slug: true }).partial();

/** Strip credentials from a tenant record before returning to the admin UI */
function safeTenant(slug: string, cfg: TenantConfig) {
    const { odoo_password, odoo_username, ...safe } = cfg;
    return { slug, ...safe };
}

// ── POST /admin/tenants — register or update a tenant ─────────────────────────
adminRouter.post('/tenants', async (req, res) => {
    try {
        const { slug, ...fields } = tenantBodySchema.parse(req.body);
        const existing = await tenantStore.getTenant(slug);

        // Auto-generate subscription_number if creating new tenant without one
        let subscriptionNumber = fields.subscription_number ?? existing?.subscription_number;
        if (!subscriptionNumber) {
            subscriptionNumber = await generateSubscriptionNumber();
        }

        const cfg = applyTenantDefaults({
            ...existing,
            ...fields,
            subscription_number: subscriptionNumber,
            created_at: existing?.created_at ?? new Date().toISOString(),
        });
        await tenantStore.saveTenant(slug, cfg);
        res.json({ success: true, slug, subscription_number: subscriptionNumber });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).issues ?? (error as any).errors });
        }
        console.error('Save Tenant Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants — list all tenants ─────────────────────────────────────
adminRouter.get('/tenants', async (_req, res) => {
    try {
        const tenants = await tenantStore.listTenants();
        const safe = Object.entries(tenants).map(([slug, cfg]) => safeTenant(slug, cfg));
        res.json(safe);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug — single tenant detail ───────────────────────────
adminRouter.get('/tenants/:slug', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        res.json(safeTenant(req.params.slug, cfg));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── PUT /admin/tenants/:slug — update a tenant ────────────────────────────────
adminRouter.put('/tenants/:slug', async (req, res) => {
    try {
        const existing = await tenantStore.getTenant(req.params.slug);
        if (!existing) return res.status(404).json({ error: 'Tenant not found' });

        const updates = tenantUpdateSchema.parse(req.body);

        // Zod .partial() returns undefined for absent optional fields.
        // Spreading those undefined values would overwrite existing credentials with undefined,
        // which applyTenantDefaults then converts to ''. Strip them first.
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        ) as typeof updates;

        // Auto-generate subscription_number if the tenant doesn't have one yet
        let subscriptionNumber = cleanUpdates.subscription_number ?? existing.subscription_number;
        if (!subscriptionNumber) {
            subscriptionNumber = await generateSubscriptionNumber();
        }

        const merged = applyTenantDefaults({ ...existing, ...cleanUpdates, subscription_number: subscriptionNumber });
        await tenantStore.saveTenant(req.params.slug, merged);
        res.json({ success: true, tenant: safeTenant(req.params.slug, merged) });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).issues ?? (error as any).errors });
        }
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /admin/tenants/:slug — remove a tenant ─────────────────────────────
adminRouter.delete('/tenants/:slug', async (req, res) => {
    try {
        const existing = await tenantStore.getTenant(req.params.slug);
        if (!existing) return res.status(404).json({ error: 'Tenant not found' });
        await tenantStore.deleteTenant(req.params.slug);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug/health — probe Odoo connectivity ─────────────────
adminRouter.get('/tenants/:slug/health', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });

        const client = getOdooClient(req.params.slug, cfg);
        const start = Date.now();
        try {
            const uid = await client.authenticate();
            const version = await client.getVersion().catch(() => null);
            res.json({ ok: true, odoo_version: version, latency_ms: Date.now() - start, uid });
        } catch (odooErr: any) {
            res.json({ ok: false, error: odooErr?.message ?? 'Connection failed', latency_ms: Date.now() - start });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug/stats — per-tenant metrics ──────────────────────
adminRouter.get('/tenants/:slug/stats', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });

        const slug = req.params.slug;

        // Count push tokens (active devices)
        const allTokens = await pushStore.listAllTokens().catch(() => [] as { tenantId: string; employeeId: number }[]);
        const active_devices = allTokens.filter(t => t.tenantId === slug).length;

        // Count notifications
        const notifKey = `shadow:t:${slug}:notifications`;
        let notifications: any[] = [];
        try {
            const raw = await redisGet(notifKey);
            notifications = raw ? JSON.parse(raw) : [];
        } catch { /* ignore */ }

        const notifications_total = notifications.length;
        const notifications_unread = notifications.filter((n: any) => !n.read).length;

        // Last sync: find the newest updatedAt in request cache keys for this tenant
        let last_sync: string | null = null;
        try {
            const cacheKeys = await redisScan(`shadow:t:${slug}:req_cache:*`);
            if (cacheKeys.length > 0) {
                const times: number[] = [];
                for (const key of cacheKeys.slice(0, 20)) { // sample up to 20
                    const raw = await redisGet(key).catch(() => null);
                    if (!raw) continue;
                    const cache = JSON.parse(raw) as Record<string, { updated_at?: string }>;
                    for (const entry of Object.values(cache)) {
                        if (entry.updated_at) times.push(new Date(entry.updated_at).getTime());
                    }
                }
                if (times.length > 0) last_sync = new Date(Math.max(...times)).toISOString();
            }
        } catch { /* ignore */ }

        res.json({ active_devices, notifications_total, notifications_unread, last_sync });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug/devices — list registered push token devices ─────
adminRouter.get('/tenants/:slug/devices', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        const devices = await pushStore.listDevicesForTenant(req.params.slug);
        res.json(devices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug/notifications — paginated notification history ───
adminRouter.get('/tenants/:slug/notifications', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
        const offset = parseInt(String(req.query.offset ?? '0'), 10);
        const result = await notificationStore.listAllForTenant(req.params.slug, limit, offset);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/tenants/:slug/errors — error log ───────────────────────────────
adminRouter.get('/tenants/:slug/errors', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        const errors = await getErrors(req.params.slug);
        res.json({ errors });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /admin/tenants/:slug/errors — clear error log ─────────────────────
adminRouter.delete('/tenants/:slug/errors', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        await clearErrors(req.params.slug);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── POST /admin/tenants/:slug/send-invoice — send invoice email via Resend ───
adminRouter.post('/tenants/:slug/send-invoice', async (req, res) => {
    try {
        const cfg = await tenantStore.getTenant(req.params.slug);
        if (!cfg) return res.status(404).json({ error: 'Tenant not found' });
        if (!cfg.contact_email) return res.status(400).json({ error: 'Tenant has no contact email configured' });
        if (!config.resendApiKey) return res.status(503).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });

        const now = new Date();
        const billingPeriod = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const subNum = cfg.subscription_number || req.params.slug.toUpperCase();
        const invoiceNumber = `INV-${subNum}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Compute due date: 15 days from now
        const dueDate = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0];

        // Get plan name and compute effective amount
        const plan = await planStore.getPlan(cfg.subscription_plan).catch(() => null);
        const planName = plan?.name ?? (cfg.subscription_plan.charAt(0).toUpperCase() + cfg.subscription_plan.slice(1));

        let invoiceAmount = cfg.monthly_amount;
        let activeEmployees: number | undefined;
        let pricePerEmployee: number | undefined;
        if (plan?.pricing_model === 'per_employee' && plan.price_per_employee) {
            const devices = await pushStore.listDevicesForTenant(req.params.slug).catch(() => [] as any[]);
            activeEmployees = devices.length;
            pricePerEmployee = plan.price_per_employee;
            invoiceAmount = activeEmployees * pricePerEmployee;
        }

        const html = generateInvoiceHTML({
            tenantName: cfg.name,
            subscriptionNumber: subNum,
            planName,
            billingFrequency: cfg.billing_frequency ?? 'monthly',
            amount: invoiceAmount,
            billingPeriod,
            dueDate,
            contactName: cfg.contact_name,
            contactEmail: cfg.contact_email,
            invoiceNumber,
            activeEmployees,
            pricePerEmployee,
        });

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: config.resendFromEmail,
                to: cfg.contact_email,
                subject: `Invoice ${invoiceNumber} — ${cfg.name}`,
                html,
            }),
        });

        if (!emailRes.ok) {
            const err = await emailRes.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(502).json({ error: 'Email delivery failed', details: err });
        }

        const result = await emailRes.json();
        res.json({ status: 'sent', invoice_number: invoiceNumber, email_id: result.id });
    } catch (error: any) {
        console.error('Send Invoice Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── GET /admin/stats — platform-wide metrics ──────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
    try {
        const tenants = await tenantStore.listTenants();
        const slugs = Object.keys(tenants);
        const cfgs = Object.values(tenants);

        const total = slugs.length;
        const active = cfgs.filter(t => t.subscription_status === 'active' && t.enabled).length;
        const overdue = cfgs.filter(t => t.subscription_status === 'overdue').length;
        const suspended = cfgs.filter(t => t.subscription_status === 'suspended').length;
        const trial = cfgs.filter(t => t.subscription_status === 'trial').length;

        const allTokens = await pushStore.listAllTokens().catch(() => [] as { tenantId: string; employeeId: number }[]);
        const total_push_tokens = allTokens.length;

        // Load plans once to resolve per-employee rates
        const allPlans = await planStore.listPlans().catch(() => [] as SubscriptionPlan[]);
        const planMap = new Map(allPlans.map(p => [p.id, p]));

        // MRR: for per-employee plans, compute dynamically from active device count
        const billingTenants = slugs.filter(slug =>
            tenants[slug].enabled && ['active', 'overdue'].includes(tenants[slug].subscription_status)
        );
        let monthly_revenue = 0;
        for (const slug of billingTenants) {
            const t = tenants[slug];
            const plan = planMap.get(t.subscription_plan);
            if (plan?.pricing_model === 'per_employee' && plan.price_per_employee) {
                const devices = await pushStore.listDevicesForTenant(slug).catch(() => [] as any[]);
                monthly_revenue += devices.length * plan.price_per_employee;
            } else {
                monthly_revenue += t.monthly_amount ?? 0;
            }
        }

        // Renewals in next 30 days
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const upcoming_renewals = slugs
            .filter(slug => {
                const r = tenants[slug].subscription_renewal;
                if (!r) return false;
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
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ── Plan management routes ────────────────────────────────────────────────────

const planSchema = z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase letters, numbers, and hyphens only'),
    name: z.string().min(1),
    max_employees: z.number().int().min(0).default(10),
    billing_frequencies: z.array(z.enum(['monthly', 'quarterly', 'yearly'])).min(1),
    prices: z.object({
        monthly: z.number().min(0),
        quarterly: z.number().min(0),
        yearly: z.number().min(0),
    }),
    support_tier: z.string().min(1),
    custom_odoo_apps: z.boolean().default(false),
    is_active: z.boolean().default(true),
    created_at: z.string().optional(),
    pricing_model: z.enum(['fixed', 'per_employee']).default('fixed'),
    price_per_employee: z.number().min(0).optional(),
});

// GET /admin/plans
adminRouter.get('/plans', async (_req, res) => {
    try {
        const plans = await planStore.listPlans();
        res.json(plans);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /admin/plans — create new plan
adminRouter.post('/plans', async (req, res) => {
    try {
        const data = planSchema.parse(req.body);
        const existing = await planStore.getPlan(data.id);
        if (existing) {
            return res.status(409).json({ error: `Plan '${data.id}' already exists` });
        }
        const plan: SubscriptionPlan = {
            ...data,
            created_at: data.created_at ?? new Date().toISOString(),
        };
        await planStore.savePlan(plan);
        res.json({ success: true, plan });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).issues ?? (error as any).errors });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT /admin/plans/:planId — update plan
adminRouter.put('/plans/:planId', async (req, res) => {
    try {
        const existing = await planStore.getPlan(req.params.planId);
        if (!existing) return res.status(404).json({ error: 'Plan not found' });

        const updates = planSchema.partial().parse(req.body);
        const updated: SubscriptionPlan = { ...existing, ...updates, id: existing.id };
        await planStore.savePlan(updated);
        res.json({ success: true, plan: updated });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).issues ?? (error as any).errors });
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE /admin/plans/:planId
adminRouter.delete('/plans/:planId', async (req, res) => {
    try {
        // Guard: reject if any tenant uses this plan
        const tenants = await tenantStore.listTenants();
        const inUse = Object.entries(tenants).filter(([, cfg]) => cfg.subscription_plan === req.params.planId);
        if (inUse.length > 0) {
            return res.status(400).json({
                error: `Cannot delete plan '${req.params.planId}' — ${inUse.length} tenant(s) are using it.`,
                tenants: inUse.map(([slug, cfg]) => ({ slug, name: cfg.name })),
            });
        }

        const deleted = await planStore.deletePlan(req.params.planId);
        if (!deleted) return res.status(404).json({ error: 'Plan not found' });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { authRouter, adminRouter };
