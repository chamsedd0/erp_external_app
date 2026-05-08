import type { Tenant, PlatformStats, TenantStats, HealthResult, TenantFormData, DeviceEntry, NotificationPage, SubscriptionPlan, ErrorLogEntry } from './types';

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

    getDevices: (slug: string): Promise<DeviceEntry[]> =>
        adminFetch(`/admin/tenants/${slug}/devices`),

    getNotifications: (slug: string, limit = 50, offset = 0): Promise<NotificationPage> =>
        adminFetch(`/admin/tenants/${slug}/notifications?limit=${limit}&offset=${offset}`),

    // ── Error log ─────────────────────────────────────────────────────────────

    getErrors: (slug: string): Promise<{ errors: ErrorLogEntry[] }> =>
        adminFetch(`/admin/tenants/${slug}/errors`),

    clearErrors: (slug: string): Promise<{ success: boolean }> =>
        adminFetch(`/admin/tenants/${slug}/errors`, { method: 'DELETE' }),

    // ── Invoice ───────────────────────────────────────────────────────────────

    sendInvoice: (slug: string): Promise<{ status: string; invoice_number: string; email_id?: string }> =>
        adminFetch(`/admin/tenants/${slug}/send-invoice`, { method: 'POST' }),

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
