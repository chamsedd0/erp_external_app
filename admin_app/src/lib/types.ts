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
    billing_frequency?: 'monthly' | 'quarterly' | 'yearly';
    subscription_number?: string;   // 'SP-00001'

    enabled: boolean;
    created_at: string;
    notes?: string;
}

// ── Subscription Plan ─────────────────────────────────────────────────────────

export interface SubscriptionPlan {
    id: string;
    name: string;
    max_employees: number;          // 0 = unlimited
    billing_frequencies: Array<'monthly' | 'quarterly' | 'yearly'>;
    prices: { monthly: number; quarterly: number; yearly: number };
    support_tier: string;
    custom_odoo_apps: boolean;
    is_active: boolean;
    created_at: string;
}

// ── Error log ─────────────────────────────────────────────────────────────────

export interface ErrorLogEntry {
    timestamp: string;
    method: string;
    path: string;
    status: number;
    error: string;
    employee_id?: number;
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

// ── Devices ───────────────────────────────────────────────────────────────────

export interface DeviceEntry {
    employeeId: number;
    token_preview: string;
    registered_at: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationEntry {
    id: string;
    employeeId: number;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string;
    targetId?: string;
    targetType?: string;
}

export interface NotificationPage {
    total: number;
    items: NotificationEntry[];
}
