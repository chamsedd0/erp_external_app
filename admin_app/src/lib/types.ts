// ── Tenant ────────────────────────────────────────────────────────────────────

export interface Tenant {
    slug: string;
    name: string;
    hr_email: string;
    odoo_url: string;
    odoo_db: string;
    odoo_username?: string;

    contact_name: string;
    contact_email: string;
    contact_phone?: string;

    subscription_plan: 'starter' | 'professional' | 'enterprise';
    subscription_status: 'trial' | 'active' | 'overdue' | 'suspended' | 'cancelled';
    subscription_start: string;
    subscription_renewal: string;
    monthly_amount: number;

    enabled: boolean;
    created_at: string;
    notes?: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface PlatformStats {
    total: number;
    active: number;
    overdue: number;
    suspended: number;
    trial: number;
    total_push_tokens: number;
    monthly_revenue: number;
    upcoming_renewals: { slug: string; name: string; renewal: string }[];
}

export interface TenantStats {
    active_devices: number;
    notifications_total: number;
    notifications_unread: number;
    last_sync: string | null;
}

export interface HealthResult {
    ok: boolean;
    odoo_version?: number | null;
    latency_ms?: number;
    error?: string;
}

// ── Forms ─────────────────────────────────────────────────────────────────────

export type TenantFormData = Omit<Tenant, 'slug' | 'created_at'> & {
    odoo_password?: string;
};
