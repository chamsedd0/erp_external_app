import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants';

// ── Shared Types ──────────────────────────────────────────────────────────────

export interface Attachment {
    name: string;
    data: string;     // base64 encoded file content
    mimetype: string; // e.g. 'image/jpeg', 'application/pdf'
}

// ── Unauthorized handler ──────────────────────────────────────────────────────
// Registered by SessionProvider so apiFetch can trigger a sign-out on 401.

let _onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void) => {
    _onUnauthorized = handler;
};

// ── Generic fetch helper ──────────────────────────────────────────────────────

async function apiFetch<T = any>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const token = await AsyncStorage.getItem('user_token').catch(() => null);

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options?.headers as Record<string, string> || {}),
        },
    });

    if (response.status === 401) {
        _onUnauthorized?.();
        throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Request failed (${response.status})`);
    }
    return await response.json();
}

// ── API Client ────────────────────────────────────────────────────────────────

export const apiClient = {

    // ── Auth ──────────────────────────────────────────────────────────────────

    login: (employee_id: string, pin: string, tenant_slug: string) =>
        apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ employee_id, pin, tenant_slug }),
        }),

    getTenantInfo: (slug: string) =>
        apiFetch(`/auth/tenant/${slug}`),

    savePushToken: (employee_id: number, token: string, tenant_slug: string) =>
        apiFetch('/auth/push-token', {
            method: 'POST',
            body: JSON.stringify({ employee_id, token, tenant_slug }),
        }),

    deletePushToken: (employee_id: number, tenant_slug: string) =>
        apiFetch('/auth/push-token', {
            method: 'DELETE',
            body: JSON.stringify({ employee_id, tenant_slug }),
        }),

    // ── Time Off ──────────────────────────────────────────────────────────────

    getTimeOffTypes: () => apiFetch('/time-off/types'),

    getTimeOffRequests: (employeeId: number) =>
        apiFetch(`/time-off?employee_id=${employeeId}`),

    getPendingTimeOff: () => apiFetch('/time-off/pending'),

    createTimeOffRequest: (data: {
        employee_id: number;
        leave_type_id: number;  // renamed from holiday_status_id in Odoo 17+
        date_from: string;
        date_to: string;
        name?: string;
        attachments?: Attachment[];
    }) =>
        apiFetch('/time-off', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Expenses ──────────────────────────────────────────────────────────────

    getExpenseProducts: () => apiFetch('/expenses/products'),

    getExpenses: (employeeId: number) =>
        apiFetch(`/expenses?employee_id=${employeeId}`),

    getPendingExpenses: () => apiFetch('/expenses/pending'),

    createExpense: (data: {
        employee_id: number;
        product_id: number;
        name: string;
        unit_amount: number;
        quantity: number;
        date: string;
        attachments?: Attachment[];
    }) =>
        apiFetch('/expenses', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Timesheet ─────────────────────────────────────────────────────────────

    getTimesheetEntries: (employeeId: number) =>
        apiFetch(`/timesheet?employee_id=${employeeId}`),

    getProjects: () => apiFetch('/timesheet/projects'),

    getTasks: (projectId: number) =>
        apiFetch(`/timesheet/tasks?project_id=${projectId}`),

    createTimesheetEntry: (data: {
        employee_id: number;
        project_id: number;
        task_id?: number;
        date: string;
        unit_amount: number;
        name: string;
    }) =>
        apiFetch('/timesheet', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── IT Support / Helpdesk ─────────────────────────────────────────────────

    getHelpdeskTickets: (employeeId: number) =>
        apiFetch(`/helpdesk?employee_id=${employeeId}`),

    getHelpdeskTeams: () => apiFetch('/helpdesk/teams'),

    createHelpdeskTicket: (data: {
        employee_id: number;
        name: string;
        description?: string;
        team_id?: number;
        attachments?: Attachment[];
    }) =>
        apiFetch('/helpdesk', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Maintenance ───────────────────────────────────────────────────────────

    getMaintenanceRequests: (employeeId: number) =>
        apiFetch(`/maintenance?employee_id=${employeeId}`),

    getMaintenanceCategories: () => apiFetch('/maintenance/categories'),

    createMaintenanceRequest: (data: {
        employee_id: number;
        name: string;
        description?: string;
        category_id?: number;
        maintenance_type?: 'corrective' | 'preventive';
        attachments?: Attachment[];
    }) =>
        apiFetch('/maintenance', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Notifications ─────────────────────────────────────────────────────────

    getNotifications: (employeeId: number) =>
        apiFetch(`/notifications?employee_id=${employeeId}`),

    markNotificationRead: (id: string) =>
        apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),

    markAllNotificationsRead: () =>
        apiFetch('/notifications/read-all', { method: 'PUT' }),
};
