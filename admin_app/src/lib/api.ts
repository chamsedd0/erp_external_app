import type { Tenant, PlatformStats, TenantStats, HealthResult, TenantFormData, DeviceEntry, NotificationPage, SubscriptionPlan, ErrorLogEntry, ActivationEntry, InviteResult, TenantDiagnostics, CertificationRun, CertificationRunRequest } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';

async function adminFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'x-admin-secret': ADMIN_SECRET,
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        // Surface field-level Zod errors so the UI can show which field is invalid
        if (body.details?.length) {
            const fields = (body.details as Array<{ path: string[]; message: string }>)
                .map(d => `${d.path.join('.')} — ${d.message}`)
                .join('; ');
            throw new Error(`${body.error}: ${fields}`);
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    return res.json();
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export const api = {
    listTenants: (): Promise<Tenant[]> =>
        adminFetch('/admin/tenants'),

    getTenant: (slug: string): Promise<Tenant> =>
        adminFetch(`/admin/tenants/${slug}`),

    createTenant: (slug: string, data: TenantFormData): Promise<{ success: boolean; slug: string }> =>
        adminFetch('/admin/tenants', {
            method: 'POST',
            body: JSON.stringify({ slug, ...data }),
        }),

    updateTenant: (slug: string, data: Partial<TenantFormData>): Promise<{ success: boolean; tenant: Tenant }> =>
        adminFetch(`/admin/tenants/${slug}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deleteTenant: (slug: string): Promise<{ success: boolean }> =>
        adminFetch(`/admin/tenants/${slug}`, { method: 'DELETE' }),

    // ── Stats & health ────────────────────────────────────────────────────────

    getPlatformStats: (): Promise<PlatformStats> =>
        adminFetch('/admin/stats'),

    getTenantStats: (slug: string): Promise<TenantStats> =>
        adminFetch(`/admin/tenants/${slug}/stats`),

    getTenantHealth: (slug: string): Promise<HealthResult> =>
        adminFetch(`/admin/tenants/${slug}/health`),

    getTenantDiagnostics: (slug: string): Promise<TenantDiagnostics> =>
        adminFetch(`/admin/tenants/${slug}/diagnostics`),

    refreshTenantSchema: (slug: string, model?: string): Promise<{ success: boolean; refreshed_models: string[]; refreshed_at: string }> =>
        adminFetch(`/admin/tenants/${slug}/schema-cache/refresh`, {
            method: 'POST',
            body: JSON.stringify(model ? { model } : {}),
        }),

    runCertification: (slug: string, data: CertificationRunRequest): Promise<CertificationRun> =>
        adminFetch(`/admin/tenants/${slug}/certification/run`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getLatestCertification: (slug: string): Promise<{ run: CertificationRun | null }> =>
        adminFetch(`/admin/tenants/${slug}/certification/latest`),

    listCertifications: (slug: string): Promise<{ runs: CertificationRun[] }> =>
        adminFetch(`/admin/tenants/${slug}/certification/runs`),

    overrideCertification: (slug: string, run_id: string, note: string): Promise<{ success: boolean }> =>
        adminFetch(`/admin/tenants/${slug}/certification/override`, {
            method: 'POST',
            body: JSON.stringify({ run_id, note }),
        }),

    getDevices: (slug: string): Promise<DeviceEntry[]> =>
        adminFetch(`/admin/tenants/${slug}/devices`),

    getActivations: (slug: string): Promise<{ activations: ActivationEntry[] }> =>
        adminFetch(`/admin/tenants/${slug}/activations`),

    createInvite: (slug: string, employee_id: number): Promise<InviteResult> =>
        adminFetch(`/admin/tenants/${slug}/invites`, {
            method: 'POST',
            body: JSON.stringify({ employee_id }),
        }),

    getNotifications: (slug: string, limit = 50, offset = 0): Promise<NotificationPage> =>
        adminFetch(`/admin/tenants/${slug}/notifications?limit=${limit}&offset=${offset}`),

    // ── Error log ─────────────────────────────────────────────────────────────

    getErrors: (slug: string): Promise<{ errors: ErrorLogEntry[] }> =>
        adminFetch(`/admin/tenants/${slug}/errors`),

    clearErrors: (slug: string): Promise<{ success: boolean }> =>
        adminFetch(`/admin/tenants/${slug}/errors`, { method: 'DELETE' }),

    // ── Invoice ───────────────────────────────────────────────────────────────

    sendQuotation: (slug: string): Promise<{ status: string; quotation_number: string; email_id?: string }> =>
        adminFetch(`/admin/tenants/${slug}/send-quotation`, { method: 'POST' }),

    probeOdooHealth: (data: {
        odoo_url: string;
        odoo_db: string;
        odoo_username: string;
        odoo_password: string;
    }): Promise<{ ok: boolean; odoo_version?: number; latency_ms?: number; error?: string }> =>
        adminFetch('/admin/health/probe', { method: 'POST', body: JSON.stringify(data) }),

    activateTenant: (slug: string, data?: {
        subscription_start?: string;
        subscription_renewal?: string;
    }): Promise<{ success: boolean; subscription_number: string }> =>
        adminFetch(`/admin/tenants/${slug}/activate`, { method: 'POST', body: JSON.stringify(data ?? {}) }),

    // ── Plans ─────────────────────────────────────────────────────────────────

    listPlans: (): Promise<SubscriptionPlan[]> =>
        adminFetch('/admin/plans'),

    createPlan: (plan: Omit<SubscriptionPlan, 'created_at'>): Promise<{ success: boolean; plan: SubscriptionPlan }> =>
        adminFetch('/admin/plans', { method: 'POST', body: JSON.stringify(plan) }),

    updatePlan: (id: string, updates: Partial<SubscriptionPlan>): Promise<{ success: boolean; plan: SubscriptionPlan }> =>
        adminFetch(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

    deletePlan: (id: string): Promise<{ success: boolean }> =>
        adminFetch(`/admin/plans/${id}`, { method: 'DELETE' }),
};
