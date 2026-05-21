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
const planStore_1 = require("../lib/planStore");
const errorLog_1 = require("../lib/errorLog");
const invoiceTemplate_1 = require("../lib/invoiceTemplate");
const redis_1 = require("../lib/redis");
const authContext_1 = require("../lib/authContext");
const portalAuthStore_1 = require("../lib/portalAuthStore");
// ── Auth routes ───────────────────────────────────────────────────────────────
const authRouter = (0, express_1.Router)();
exports.authRouter = authRouter;
const loginSchema = zod_1.z.object({
    employee_id: zod_1.z.string().optional(),
    identifier: zod_1.z.string().optional(),
    work_email: zod_1.z.string().email().optional(),
    pin: zod_1.z.string(),
    tenant_slug: zod_1.z.string().optional(),
    tenant_code: zod_1.z.string().optional(),
    tenant_subscription_number: zod_1.z.string().optional(),
}).refine(d => d.tenant_slug || d.tenant_subscription_number || d.tenant_code, {
    message: 'tenant_slug, tenant_code, or tenant_subscription_number is required',
}).refine(d => d.employee_id || d.identifier || d.work_email, {
    message: 'employee_id, identifier, or work_email is required',
});
const activationStartSchema = zod_1.z.object({
    tenant_code: zod_1.z.string().optional(),
    tenant_slug: zod_1.z.string().optional(),
    tenant_subscription_number: zod_1.z.string().optional(),
    work_email: zod_1.z.string().email(),
}).refine(d => d.tenant_code || d.tenant_slug || d.tenant_subscription_number, {
    message: 'tenant_code, tenant_slug, or tenant_subscription_number is required',
});
const activationVerifySchema = activationStartSchema.extend({
    otp: zod_1.z.string().min(4).max(12),
    pin: zod_1.z.string(),
});
const inviteVerifySchema = zod_1.z.object({
    tenant_code: zod_1.z.string().optional(),
    tenant_slug: zod_1.z.string().optional(),
    tenant_subscription_number: zod_1.z.string().optional(),
    invite_code: zod_1.z.string().min(6),
    pin: zod_1.z.string(),
}).refine(d => d.tenant_code || d.tenant_slug || d.tenant_subscription_number, {
    message: 'tenant_code, tenant_slug, or tenant_subscription_number is required',
});
async function resolveTenantCode(rawCode) {
    const direct = await (0, tenantStore_1.resolveToSlug)(rawCode).catch(() => null);
    if (direct)
        return direct;
    const trimmed = rawCode.trim();
    if (await tenantStore_1.tenantStore.getTenant(trimmed).catch(() => null))
        return trimmed;
    const lower = trimmed.toLowerCase();
    if (await tenantStore_1.tenantStore.getTenant(lower).catch(() => null))
        return lower;
    return null;
}
function tenantAccessDisabled(cfg) {
    return !cfg.enabled || ['suspended', 'cancelled', 'draft'].includes(cfg.subscription_status);
}
function signEmployeeToken(tenantId, employee) {
    return jsonwebtoken_1.default.sign({
        id: employee.id,
        name: employee.name,
        role: 'employee',
        tenantId,
    }, config_1.config.jwtSecret, { expiresIn: '7d' });
}
function formatLoginResponse(tenantId, employee) {
    return {
        token: signEmployeeToken(tenantId, employee),
        user: {
            id: employee.id,
            name: employee.name,
            department: employee.department_id ? employee.department_id[1] : null,
            job_title: employee.job_title,
            work_email: employee.work_email,
        },
    };
}
async function sendActivationEmail(to, otp, tenantName) {
    if (!config_1.config.resendApiKey) {
        if (process.env.NODE_ENV === 'production') {
            throw Object.assign(new Error('Email service not configured'), { statusCode: 503 });
        }
        console.log(`[activation] OTP for ${to} (${tenantName}): ${otp}`);
        return;
    }
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config_1.config.resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: config_1.config.resendFromEmail,
            to,
            subject: `${tenantName} mobile app activation code`,
            html: `<p>Your activation code is <strong>${otp}</strong>. It expires in ${Math.floor(config_1.config.activationOtpTtlSeconds / 60)} minutes.</p>`,
        }),
    });
    if (!response.ok) {
        throw Object.assign(new Error('Email delivery failed'), { statusCode: 502 });
    }
}
async function loadEmployeeForLogin(tenantId, tenantConfig, employeeId, workEmail, fallbackName) {
    const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
    const uid = await client.authenticate();
    const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', employeeId]], ['id', 'name', 'department_id', 'job_title', 'work_email'], true).catch(() => []);
    if (Array.isArray(employees) && employees[0])
        return employees[0];
    return {
        id: employeeId,
        name: fallbackName ?? `Employee ${employeeId}`,
        department_id: null,
        job_title: null,
        work_email: workEmail ?? null,
    };
}
function classifyLoginOdooError(error) {
    const raw = String(error?.faultString || error?.faultMessage || error?.message || error || '').toLowerCase();
    if ((raw.includes('invalid field') || raw.includes('unknown field')) && (raw.includes('pin') || raw.includes('barcode'))) {
        return {
            status: 422,
            message: 'Employee portal credentials are not configured for this company. Please use first-time activation or contact your administrator.',
            reason: 'missing_employee_auth_fields',
        };
    }
    if (raw.includes('authentication failure') || raw.includes('access denied') || raw.includes('wrong login') || raw.includes('invalid database')) {
        return {
            status: 502,
            message: 'Company connection is not configured correctly. Please contact your administrator.',
            reason: 'tenant_odoo_auth_or_db',
        };
    }
    if (raw.includes('timeout') || raw.includes('etimedout') || raw.includes('econn') || raw.includes('enotfound') || raw.includes('certificate') || raw.includes('socket') || raw.includes('xml-rpc')) {
        return {
            status: 502,
            message: 'Company system is temporarily unavailable. Please try again later.',
            reason: 'tenant_odoo_unavailable',
        };
    }
    return {
        status: 502,
        message: 'Could not verify employee credentials with the company system. Please try again or contact your administrator.',
        reason: 'tenant_odoo_unknown',
    };
}
authRouter.post('/login', async (req, res) => {
    let tenantId = null;
    let stage = 'parse_input';
    try {
        const body = loginSchema.parse(req.body);
        // 1. Resolve tenant — accepts SP number (SP-XXXXX) or slug for backward compat
        stage = 'resolve_tenant';
        const rawCode = body.tenant_code ?? body.tenant_slug ?? body.tenant_subscription_number;
        tenantId = await resolveTenantCode(rawCode);
        if (!tenantId)
            return res.status(401).json({ error: 'Unknown company code' });
        stage = 'load_tenant';
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig) {
            return res.status(401).json({ error: 'Unknown company code' });
        }
        // 2. Reject login if tenant is disabled / suspended / cancelled / draft
        if (tenantAccessDisabled(tenantConfig)) {
            return res.status(403).json({ error: 'Account access is currently disabled. Please contact your administrator.' });
        }
        const identifier = (body.work_email ?? body.identifier ?? body.employee_id ?? '').trim();
        const portalEmail = identifier.includes('@') ? identifier : body.work_email;
        if (portalEmail) {
            stage = 'portal_credential_lookup';
            const credential = await portalAuthStore_1.portalAuthStore.getCredentialByEmail(tenantId, portalEmail);
            if (await portalAuthStore_1.portalAuthStore.verifyCredential(credential, body.pin)) {
                stage = 'portal_employee_load';
                const employee = await loadEmployeeForLogin(tenantId, tenantConfig, credential.employeeId, credential?.workEmail, credential?.name);
                return res.json(formatLoginResponse(tenantId, employee));
            }
        }
        // 3. Max employee check — based on plan's max_employees
        const plan = await planStore_1.planStore.getPlan(tenantConfig.subscription_plan).catch(() => null);
        const maxEmployees = plan?.max_employees ?? { starter: 10, professional: 50, enterprise: 0 }[tenantConfig.subscription_plan] ?? 10;
        if (maxEmployees > 0) {
            const empId = parseInt(identifier, 10);
            const existingToken = !isNaN(empId) ? await Promise.resolve(pushStore_1.pushStore.getToken?.(tenantId, empId) ?? null).catch(() => null) : null;
            if (!existingToken) {
                // Employee has no registered device — count existing unique employees
                const devices = await Promise.resolve(pushStore_1.pushStore.listDevicesForTenant?.(tenantId) ?? []).catch(() => []);
                if (devices.length >= maxEmployees) {
                    return res.status(403).json({
                        error: 'Employee limit reached for this subscription plan. Contact your administrator.',
                    });
                }
            }
        }
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        // 4. Authenticate Admin to get UID
        stage = 'odoo_authenticate';
        const uid = await client.authenticate();
        // 5. Search for Employee
        stage = 'odoo_employee_search';
        const employees = await client.searchEmployee(uid, identifier, body.pin);
        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json(formatLoginResponse(tenantId, employees[0]));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        const classified = classifyLoginOdooError(error);
        console.error('[auth/login] failed', {
            stage,
            tenantId,
            reason: classified.reason,
            message: error instanceof Error ? error.message : String(error?.faultString || error),
        });
        res.status(classified.status).json({ error: classified.message });
    }
});
/** GET /auth/tenant/:code — public, returns display info only (no credentials).
 *  Accepts SP number (SP-XXXXX) or slug. Returns subscription_number — never the slug. */
authRouter.get('/tenant/:code', async (req, res) => {
    const slug = await resolveTenantCode(req.params.code);
    if (!slug)
        return res.status(404).json({ error: 'Company not found' });
    const cfg = await tenantStore_1.tenantStore.getTenant(slug);
    if (!cfg)
        return res.status(404).json({ error: 'Company not found' });
    res.json({
        name: cfg.name,
        hr_email: cfg.hr_email,
        // Return the SP number so the mobile app stores it — never expose the internal slug
        subscription_number: cfg.subscription_number || req.params.code.toUpperCase(),
    });
});
// ── Push Notification Token Management ───────────────────────────────────────
authRouter.post('/activation/start', async (req, res) => {
    try {
        const body = activationStartSchema.parse(req.body);
        const rawCode = body.tenant_code ?? body.tenant_slug ?? body.tenant_subscription_number;
        const tenantId = await resolveTenantCode(rawCode);
        const generic = { success: true, message: 'If this email can be activated, a code has been sent.' };
        if (!tenantId)
            return res.json(generic);
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig || tenantAccessDisabled(tenantConfig))
            return res.json(generic);
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        const email = portalAuthStore_1.portalAuthStore.normaliseEmail(body.work_email);
        const employees = await client.searchRead(uid, 'hr.employee', [['work_email', '=', email]], ['id', 'name', 'department_id', 'job_title', 'work_email'], true).catch(() => []);
        if (!Array.isArray(employees) || employees.length !== 1) {
            return res.json(generic);
        }
        const employee = employees[0];
        const { otp } = await portalAuthStore_1.portalAuthStore.createOtp(tenantId, employee.id, email, employee.name);
        await sendActivationEmail(email, otp, tenantConfig.name);
        res.json(process.env.NODE_ENV === 'production' ? generic : { ...generic, dev_otp: otp });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        const statusCode = error?.statusCode ?? 500;
        res.status(statusCode).json({ error: statusCode === 500 ? 'Internal server error' : error.message });
    }
});
authRouter.post('/activation/verify', async (req, res) => {
    try {
        const body = activationVerifySchema.parse(req.body);
        const rawCode = body.tenant_code ?? body.tenant_slug ?? body.tenant_subscription_number;
        const tenantId = await resolveTenantCode(rawCode);
        if (!tenantId)
            return res.status(401).json({ error: 'Invalid activation code' });
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig || tenantAccessDisabled(tenantConfig)) {
            return res.status(403).json({ error: 'Account access is currently disabled. Please contact your administrator.' });
        }
        const pinError = portalAuthStore_1.portalAuthStore.validatePinPolicy(body.pin);
        if (pinError)
            return res.status(400).json({ error: pinError });
        const otp = await portalAuthStore_1.portalAuthStore.verifyOtp(tenantId, body.work_email, body.otp);
        if (!otp)
            return res.status(401).json({ error: 'Invalid or expired activation code' });
        await portalAuthStore_1.portalAuthStore.saveCredential({
            tenantId,
            employeeId: otp.employeeId,
            workEmail: otp.workEmail,
            name: otp.name,
            pin: body.pin,
        });
        const employee = await loadEmployeeForLogin(tenantId, tenantConfig, otp.employeeId, otp.workEmail, otp.name);
        res.json(formatLoginResponse(tenantId, employee));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
authRouter.post('/activation/invite', async (req, res) => {
    try {
        const body = inviteVerifySchema.parse(req.body);
        const rawCode = body.tenant_code ?? body.tenant_slug ?? body.tenant_subscription_number;
        const tenantId = await resolveTenantCode(rawCode);
        if (!tenantId)
            return res.status(401).json({ error: 'Invalid invite code' });
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig || tenantAccessDisabled(tenantConfig)) {
            return res.status(403).json({ error: 'Account access is currently disabled. Please contact your administrator.' });
        }
        const pinError = portalAuthStore_1.portalAuthStore.validatePinPolicy(body.pin);
        if (pinError)
            return res.status(400).json({ error: pinError });
        const invite = await portalAuthStore_1.portalAuthStore.consumeInvite(tenantId, body.invite_code);
        if (!invite)
            return res.status(401).json({ error: 'Invalid or expired invite code' });
        await portalAuthStore_1.portalAuthStore.saveCredential({
            tenantId,
            employeeId: invite.employeeId,
            workEmail: invite.workEmail,
            name: invite.name,
            pin: body.pin,
        });
        const employee = await loadEmployeeForLogin(tenantId, tenantConfig, invite.employeeId, invite.workEmail, invite.name);
        res.json(formatLoginResponse(tenantId, employee));
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Accepts SP number (tenant_code) or legacy tenant_slug for backward compat
const pushTokenSchema = zod_1.z.object({
    employee_id: zod_1.z.number().optional(),
    token: zod_1.z.string().min(1),
    tenant_code: zod_1.z.string().optional(), // preferred: SP number
    tenant_subscription_number: zod_1.z.string().optional(), // alias
    tenant_slug: zod_1.z.string().optional(), // backward compat (old app versions)
});
/**
 * POST /auth/push-token
 * Saves an Expo push token for the given employee.
 * Called from the frontend after the user grants notification permission.
 */
authRouter.post('/push-token', async (req, res) => {
    try {
        const body = pushTokenSchema.parse(req.body);
        const auth = (0, authContext_1.getAuthenticatedEmployee)(req);
        await pushStore_1.pushStore.saveToken(auth.tenantId, auth.employeeId, body.token);
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
        const auth = (0, authContext_1.getAuthenticatedEmployee)(req);
        await pushStore_1.pushStore.removeToken(auth.tenantId, auth.employeeId);
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
    odoo_url: zod_1.z.union([zod_1.z.string().url(), zod_1.z.literal('')]).default(''),
    odoo_db: zod_1.z.string().default(''),
    odoo_username: zod_1.z.string().default(''),
    odoo_password: zod_1.z.string().default(''),
    contact_name: zod_1.z.string().default(''),
    contact_email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    contact_phone: zod_1.z.string().optional(),
    subscription_plan: zod_1.z.string().min(1).default('starter'),
    subscription_status: zod_1.z.enum(['trial', 'active', 'overdue', 'suspended', 'cancelled', 'draft']).default('draft'),
    subscription_start: zod_1.z.string().default(() => new Date().toISOString().split('T')[0]),
    subscription_renewal: zod_1.z.string().default(''),
    monthly_amount: zod_1.z.number().min(0).default(0),
    max_employees: zod_1.z.number().int().min(0).default(0).optional(),
    billing_frequency: zod_1.z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
    enabled: zod_1.z.boolean().default(true),
    notes: zod_1.z.string().optional(),
    subscription_number: zod_1.z.string().optional(),
});
/** Partial schema for PUT (all fields optional except slug comes from params) */
const tenantUpdateSchema = tenantBodySchema.omit({ slug: true }).partial();
/** Strip credentials from a tenant record before returning to the admin UI */
function safeTenant(slug, cfg) {
    const { odoo_password, odoo_username, ...safe } = cfg;
    return { slug, ...safe };
}
const createInviteSchema = zod_1.z.object({
    employee_id: zod_1.z.number().int().positive(),
});
// ── POST /admin/tenants — register or update a tenant ─────────────────────────
adminRouter.post('/tenants', async (req, res) => {
    try {
        const { slug, ...fields } = tenantBodySchema.parse(req.body);
        const existing = await tenantStore_1.tenantStore.getTenant(slug);
        // Auto-generate subscription_number if creating new tenant without one
        let subscriptionNumber = fields.subscription_number ?? existing?.subscription_number;
        if (!subscriptionNumber) {
            subscriptionNumber = await (0, tenantStore_1.generateSubscriptionNumber)();
        }
        const cfg = (0, tenantStore_1.applyTenantDefaults)({
            ...existing,
            ...fields,
            subscription_number: subscriptionNumber,
            created_at: existing?.created_at ?? new Date().toISOString(),
        });
        await tenantStore_1.tenantStore.saveTenant(slug, cfg);
        (0, client_1.clearOdooClientCache)(slug);
        res.json({ success: true, slug, subscription_number: subscriptionNumber });
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
        // Zod .partial() returns undefined for absent optional fields.
        // Spreading those undefined values would overwrite existing credentials with undefined,
        // which applyTenantDefaults then converts to ''. Strip them first.
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        // Auto-generate subscription_number if the tenant doesn't have one yet
        let subscriptionNumber = cleanUpdates.subscription_number ?? existing.subscription_number;
        if (!subscriptionNumber) {
            subscriptionNumber = await (0, tenantStore_1.generateSubscriptionNumber)();
        }
        const merged = (0, tenantStore_1.applyTenantDefaults)({ ...existing, ...cleanUpdates, subscription_number: subscriptionNumber });
        await tenantStore_1.tenantStore.saveTenant(req.params.slug, merged);
        (0, client_1.clearOdooClientCache)(req.params.slug);
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
        (0, client_1.clearOdooClientCache)(req.params.slug);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── POST /admin/health/probe — test Odoo credentials without a saved tenant ────
const probeSchema = zod_1.z.object({
    odoo_url: zod_1.z.string().url(),
    odoo_db: zod_1.z.string().min(1),
    odoo_username: zod_1.z.string().min(1),
    odoo_password: zod_1.z.string().min(1),
});
adminRouter.post('/health/probe', async (req, res) => {
    try {
        const { odoo_url, odoo_db, odoo_username, odoo_password } = probeSchema.parse(req.body);
        const cfg = (0, tenantStore_1.applyTenantDefaults)({ odoo_url, odoo_db, odoo_username, odoo_password });
        const client = (0, client_1.getOdooClient)('_probe', cfg);
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
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
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
adminRouter.get('/tenants/:slug/activations', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const activations = await portalAuthStore_1.portalAuthStore.listCredentials(req.params.slug);
        res.json({ activations });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
adminRouter.post('/tenants/:slug/invites', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const body = createInviteSchema.parse(req.body);
        let employee = null;
        try {
            const client = (0, client_1.getOdooClient)(req.params.slug, cfg);
            const uid = await client.authenticate();
            const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', body.employee_id]], ['id', 'name', 'work_email'], true);
            employee = Array.isArray(employees) ? employees[0] : null;
        }
        catch {
            employee = null;
        }
        const invite = await portalAuthStore_1.portalAuthStore.createInvite({
            tenantId: req.params.slug,
            employeeId: body.employee_id,
            workEmail: employee?.work_email || undefined,
            name: employee?.name || undefined,
        });
        res.json({
            invite_code: invite.code,
            employee_id: invite.employeeId,
            work_email: invite.workEmail,
            name: invite.name,
            expires_at: invite.expiresAt,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
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
// ── GET /admin/tenants/:slug/errors — error log ───────────────────────────────
adminRouter.get('/tenants/:slug/errors', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        const errors = await (0, errorLog_1.getErrors)(req.params.slug);
        res.json({ errors });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── DELETE /admin/tenants/:slug/errors — clear error log ─────────────────────
adminRouter.delete('/tenants/:slug/errors', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        await (0, errorLog_1.clearErrors)(req.params.slug);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ── POST /admin/tenants/:slug/send-quotation — send service quotation via Resend
adminRouter.post('/tenants/:slug/send-quotation', async (req, res) => {
    try {
        const cfg = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!cfg)
            return res.status(404).json({ error: 'Tenant not found' });
        if (!cfg.contact_email)
            return res.status(400).json({ error: 'Tenant has no contact email configured' });
        if (!config_1.config.resendApiKey)
            return res.status(503).json({ error: 'Email service not configured (RESEND_API_KEY missing)' });
        const now = new Date();
        const billingPeriod = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const subNum = cfg.subscription_number || req.params.slug.toUpperCase();
        const quotationNumber = `QUO-${subNum}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        // Quotation valid for 30 days
        const validUntil = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
        // Get plan name and compute effective amount
        const plan = await planStore_1.planStore.getPlan(cfg.subscription_plan).catch(() => null);
        const planName = plan?.name ?? (cfg.subscription_plan.charAt(0).toUpperCase() + cfg.subscription_plan.slice(1));
        let quotationAmount = cfg.monthly_amount;
        let activeEmployees;
        let pricePerEmployee;
        if (plan?.pricing_model === 'per_employee' && plan.price_per_employee) {
            const committedCount = cfg.max_employees && cfg.max_employees > 0 ? cfg.max_employees : undefined;
            const devices = committedCount === undefined
                ? await pushStore_1.pushStore.listDevicesForTenant(req.params.slug).catch(() => [])
                : [];
            activeEmployees = committedCount ?? devices.length;
            pricePerEmployee = plan.price_per_employee;
            quotationAmount = activeEmployees * pricePerEmployee;
        }
        const html = (0, invoiceTemplate_1.generateQuotationHTML)({
            tenantName: cfg.name,
            subscriptionNumber: subNum,
            planName,
            billingFrequency: cfg.billing_frequency ?? 'monthly',
            amount: quotationAmount,
            billingPeriod,
            validUntil,
            contactName: cfg.contact_name,
            contactEmail: cfg.contact_email,
            quotationNumber,
            activeEmployees,
            pricePerEmployee,
        });
        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config_1.config.resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: config_1.config.resendFromEmail,
                to: cfg.contact_email,
                subject: `Service Quotation ${quotationNumber} — ${cfg.name}`,
                html,
            }),
        });
        if (!emailRes.ok) {
            const err = await emailRes.json().catch(() => ({ message: 'Unknown error' }));
            return res.status(502).json({ error: 'Email delivery failed', details: err });
        }
        const result = await emailRes.json();
        res.json({ status: 'sent', quotation_number: quotationNumber, email_id: result.id });
    }
    catch (error) {
        console.error('Send Quotation Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ── POST /admin/tenants/:slug/activate — set status to trial, generate SP# ────
const activateSchema = zod_1.z.object({
    subscription_start: zod_1.z.string().optional(),
    subscription_renewal: zod_1.z.string().optional(),
});
adminRouter.post('/tenants/:slug/activate', async (req, res) => {
    try {
        const existing = await tenantStore_1.tenantStore.getTenant(req.params.slug);
        if (!existing)
            return res.status(404).json({ error: 'Tenant not found' });
        const data = activateSchema.parse(req.body);
        const subNum = existing.subscription_number || await (0, tenantStore_1.generateSubscriptionNumber)();
        const today = new Date().toISOString().split('T')[0];
        const start = data.subscription_start || existing.subscription_start || today;
        const freq = existing.billing_frequency ?? 'monthly';
        let renewal = data.subscription_renewal || existing.subscription_renewal;
        if (!renewal) {
            const d = new Date(start + 'T12:00:00');
            if (freq === 'monthly')
                d.setMonth(d.getMonth() + 1);
            else if (freq === 'quarterly')
                d.setMonth(d.getMonth() + 3);
            else
                d.setFullYear(d.getFullYear() + 1);
            renewal = d.toISOString().split('T')[0];
        }
        const updated = (0, tenantStore_1.applyTenantDefaults)({
            ...existing,
            subscription_number: subNum,
            subscription_status: 'trial',
            subscription_start: start,
            subscription_renewal: renewal,
        });
        await tenantStore_1.tenantStore.saveTenant(req.params.slug, updated);
        (0, client_1.clearOdooClientCache)(req.params.slug);
        res.json({ success: true, subscription_number: subNum });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: 'Invalid input', details: error.issues });
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
        // Load plans once to resolve per-employee rates
        const allPlans = await planStore_1.planStore.listPlans().catch(() => []);
        const planMap = new Map(allPlans.map(p => [p.id, p]));
        // MRR: for per-employee plans, compute dynamically from active device count
        const billingTenants = slugs.filter(slug => tenants[slug].enabled && ['active', 'overdue'].includes(tenants[slug].subscription_status));
        let monthly_revenue = 0;
        for (const slug of billingTenants) {
            const t = tenants[slug];
            const plan = planMap.get(t.subscription_plan);
            if (plan?.pricing_model === 'per_employee' && plan.price_per_employee) {
                const devices = await pushStore_1.pushStore.listDevicesForTenant(slug).catch(() => []);
                monthly_revenue += devices.length * plan.price_per_employee;
            }
            else {
                monthly_revenue += t.monthly_amount ?? 0;
            }
        }
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
// ── Plan management routes ────────────────────────────────────────────────────
const planSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase letters, numbers, and hyphens only'),
    name: zod_1.z.string().min(1),
    max_employees: zod_1.z.number().int().min(0).default(10),
    billing_frequencies: zod_1.z.array(zod_1.z.enum(['monthly', 'quarterly', 'yearly'])).min(1),
    prices: zod_1.z.object({
        monthly: zod_1.z.number().min(0),
        quarterly: zod_1.z.number().min(0),
        yearly: zod_1.z.number().min(0),
    }),
    support_tier: zod_1.z.string().default(''),
    custom_odoo_apps: zod_1.z.boolean().default(false),
    is_active: zod_1.z.boolean().default(true),
    created_at: zod_1.z.string().optional(),
    pricing_model: zod_1.z.enum(['fixed', 'per_employee']).default('fixed'),
    price_per_employee: zod_1.z.number().min(0).optional(),
});
// GET /admin/plans
adminRouter.get('/plans', async (_req, res) => {
    try {
        const plans = await planStore_1.planStore.listPlans();
        res.json(plans);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// POST /admin/plans — create new plan
adminRouter.post('/plans', async (req, res) => {
    try {
        const data = planSchema.parse(req.body);
        const existing = await planStore_1.planStore.getPlan(data.id);
        if (existing) {
            return res.status(409).json({ error: `Plan '${data.id}' already exists` });
        }
        const plan = {
            ...data,
            created_at: data.created_at ?? new Date().toISOString(),
        };
        await planStore_1.planStore.savePlan(plan);
        res.json({ success: true, plan });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues ?? error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// PUT /admin/plans/:planId — update plan
adminRouter.put('/plans/:planId', async (req, res) => {
    try {
        const existing = await planStore_1.planStore.getPlan(req.params.planId);
        if (!existing)
            return res.status(404).json({ error: 'Plan not found' });
        const updates = planSchema.partial().parse(req.body);
        const updated = { ...existing, ...updates, id: existing.id };
        await planStore_1.planStore.savePlan(updated);
        res.json({ success: true, plan: updated });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.issues ?? error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});
// DELETE /admin/plans/:planId
adminRouter.delete('/plans/:planId', async (req, res) => {
    try {
        // Guard: reject if any tenant uses this plan
        const tenants = await tenantStore_1.tenantStore.listTenants();
        const inUse = Object.entries(tenants).filter(([, cfg]) => cfg.subscription_plan === req.params.planId);
        if (inUse.length > 0) {
            return res.status(400).json({
                error: `Cannot delete plan '${req.params.planId}' — ${inUse.length} tenant(s) are using it.`,
                tenants: inUse.map(([slug, cfg]) => ({ slug, name: cfg.name })),
            });
        }
        const deleted = await planStore_1.planStore.deletePlan(req.params.planId);
        if (!deleted)
            return res.status(404).json({ error: 'Plan not found' });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
