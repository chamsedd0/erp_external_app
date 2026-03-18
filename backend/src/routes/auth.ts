import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getOdooClient } from '../odoo/client';
import { tenantStore, TenantConfig } from '../lib/tenantStore';
import { pushStore } from '../lib/pushStore';

// ── Auth routes ───────────────────────────────────────────────────────────────

const authRouter = Router();

const loginSchema = z.object({
    employee_id: z.string(),
    pin: z.string(),
    tenant_slug: z.string(),
});

authRouter.post('/login', async (req, res) => {
    try {
        const { employee_id, pin, tenant_slug } = loginSchema.parse(req.body);

        // 1. Look up tenant
        const tenantConfig = await tenantStore.getTenant(tenant_slug);
        if (!tenantConfig) {
            return res.status(401).json({ error: 'Unknown company code' });
        }

        const client = getOdooClient(tenant_slug, tenantConfig);

        // 2. Authenticate Admin to get UID
        const uid = await client.authenticate();

        // 3. Search for Employee
        const employees: any = await client.searchEmployee(uid, employee_id, pin);

        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const employee = employees[0];

        // 4. Generate JWT (includes tenantId)
        const token = jwt.sign(
            {
                id: employee.id,
                name: employee.name,
                role: 'employee',
                tenantId: tenant_slug,
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

/** GET /auth/tenant/:slug — public, returns display info only (no credentials) */
authRouter.get('/tenant/:slug', async (req, res) => {
    const cfg = await tenantStore.getTenant(req.params.slug);
    if (!cfg) return res.status(404).json({ error: 'Company not found' });
    res.json({ name: cfg.name, hr_email: cfg.hr_email });
});

// ── Push Notification Token Management ───────────────────────────────────────

const pushTokenSchema = z.object({
    employee_id: z.number(),
    token: z.string().min(1),
    tenant_slug: z.string(),
});

/**
 * POST /auth/push-token
 * Saves an Expo push token for the given employee.
 * Called from the frontend after the user grants notification permission.
 */
authRouter.post('/push-token', async (req, res) => {
    try {
        const { employee_id, token, tenant_slug } = pushTokenSchema.parse(req.body);
        await pushStore.saveToken(tenant_slug, employee_id, token);
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
        const tenantSlug = req.body?.tenant_slug ?? req.query?.tenant_slug;
        if (!employeeId || !tenantSlug) {
            return res.status(400).json({ error: 'employee_id and tenant_slug are required' });
        }
        await pushStore.removeToken(String(tenantSlug), parseInt(String(employeeId)));
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

const adminRouter = Router();

const tenantBodySchema = z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    hr_email: z.string().email(),
    odoo_url: z.string().url(),
    odoo_db: z.string().min(1),
    odoo_username: z.string().min(1),
    odoo_password: z.string().min(1),
});

/** POST /admin/tenants — register or update a tenant (protected by x-admin-secret) */
adminRouter.post('/tenants', async (req, res) => {
    try {
        const { slug, ...cfg } = tenantBodySchema.parse(req.body);
        await tenantStore.saveTenant(slug, cfg as TenantConfig);
        res.json({ success: true, slug });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Save Tenant Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/** GET /admin/tenants — list all tenants (protected by x-admin-secret) */
adminRouter.get('/tenants', async (_req, res) => {
    try {
        const tenants = await tenantStore.listTenants();
        // Strip passwords from response
        const safe = Object.fromEntries(
            Object.entries(tenants).map(([slug, cfg]) => [
                slug,
                { name: cfg.name, hr_email: cfg.hr_email, odoo_url: cfg.odoo_url, odoo_db: cfg.odoo_db },
            ])
        );
        res.json(safe);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export { authRouter, adminRouter };
