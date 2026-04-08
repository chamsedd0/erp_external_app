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

// ── Error sanitiser ───────────────────────────────────────────────────────────
// Converts raw backend / network errors into short, human-readable messages.

function friendlyError(raw: string, status?: number): string {
    const s = raw.toLowerCase();

    // Network / connectivity
    if (s.includes('network request failed') || s.includes('failed to fetch') || s.includes('networkerror'))
        return 'No internet connection. Please check your network and try again.';

    // Session
    if (s.includes('session expired') || s.includes('invalid or expired token'))
        return 'Your session has expired. Please log in again.';

    // Auth / login specific
    if (s.includes('invalid credentials'))
        return 'Incorrect Employee ID or PIN. Please try again.';
    if (s.includes('unknown company') || s.includes('unknown tenant'))
        return 'Company code not found. Please check and try again.';

    // Permission
    if (s.includes('access denied') || s.includes('forbidden') || s.includes('not allowed'))
        return 'You don\'t have permission to do that.';

    // Leave / time off
    if (s.includes('hr.leave') || s.includes('leave'))
        return 'Could not submit your time off request. Please check the dates and try again.';

    // Expense
    if (s.includes('hr.expense') || s.includes('expense'))
        return 'Could not submit your expense. Please check the details and try again.';

    // Helpdesk
    if (s.includes('helpdesk'))
        return 'Could not submit your support ticket. Please try again.';

    // Maintenance
    if (s.includes('maintenance'))
        return 'Could not submit your maintenance request. Please try again.';

    // Timesheet
    if (s.includes('account.analytic') || s.includes('timesheet'))
        return 'Could not log your timesheet entry. Please try again.';

    // Odoo / XML-RPC technical noise
    if (s.includes('xml-rpc') || s.includes('traceback') || s.includes('odoo') || s.includes('xmlrpc'))
        return 'Something went wrong on the server. Please try again or contact your administrator.';

    // Generic server errors
    if (status && status >= 500)
        return 'Server error. Please try again in a moment.';
    if (status && status >= 400)
        return raw.length < 120 ? raw : 'Invalid request. Please check your input.';

    // Fallback — only show the raw message if it's short enough to be readable
    return raw.length < 120 ? raw : 'Something went wrong. Please try again.';
}

// ── Generic fetch helper ──────────────────────────────────────────────────────

async function apiFetch<T = any>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const token = await AsyncStorage.getItem('user_token').catch(() => null);

    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options?.headers as Record<string, string> || {}),
            },
        });
    } catch (networkErr: any) {
        throw new Error(friendlyError(networkErr?.message || 'Network request failed'));
    }

    if (response.status === 401) {
        _onUnauthorized?.();
        throw new Error('Your session has expired. Please log in again.');
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Request failed' }));
        const raw = body.error || `Request failed (${response.status})`;
        throw new Error(friendlyError(raw, response.status));
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
