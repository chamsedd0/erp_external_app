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
        return 'Could not submit your helpdesk ticket. Please try again.';

    // Maintenance
    if (s.includes('maintenance'))
        return 'Could not submit your maintenance request. Please try again.';

    // Timesheet
    if (s.includes('account.analytic') || s.includes('timesheet'))
        return 'Could not log your timesheet entry. Please try again.';

    // Attendance
    if (s.includes('hr.attendance') || s.includes('attendance'))
        return 'Could not submit your attendance request. Please try again.';
    if (s.includes('overtime module') || s.includes('requires odoo 16'))
        return 'Overtime requests require Odoo 16 or newer. Please contact your administrator.';

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
    // No X-Company-Id: the backend derives the company from the authenticated
    // employee. One account = one hr.employee = one res.company.
    const [token, lang] = await Promise.all([
        AsyncStorage.getItem('user_token').catch(() => null),
        AsyncStorage.getItem('setting_language').catch(() => null),
    ]);

    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(lang ? { 'X-Lang': lang } : {}),
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

    login: (identifier: string, pin: string, tenant_code: string) =>
        apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, employee_id: identifier, pin, tenant_subscription_number: tenant_code }),
        }),

    getTenantInfo: (code: string) =>
        apiFetch(`/auth/tenant/${code}`),

    startActivation: (tenant_code: string, work_email: string) =>
        apiFetch('/auth/activation/start', {
            method: 'POST',
            body: JSON.stringify({ tenant_code, work_email }),
        }),

    verifyActivation: (tenant_code: string, work_email: string, otp: string, pin: string) =>
        apiFetch('/auth/activation/verify', {
            method: 'POST',
            body: JSON.stringify({ tenant_code, work_email, otp, pin }),
        }),

    activateWithInvite: (tenant_code: string, invite_code: string, pin: string) =>
        apiFetch('/auth/activation/invite', {
            method: 'POST',
            body: JSON.stringify({ tenant_code, invite_code, pin }),
        }),

    savePushToken: (employee_id: number, token: string, tenant_code: string) =>
        apiFetch('/auth/push-token', {
            method: 'POST',
            body: JSON.stringify({ employee_id, token, tenant_code }),
        }),

    deletePushToken: (employee_id: number, tenant_code: string) =>
        apiFetch('/auth/push-token', {
            method: 'DELETE',
            body: JSON.stringify({ employee_id, tenant_code }),
        }),

    deleteRegistration: () =>
        apiFetch('/auth/registration', {
            method: 'DELETE',
        }),

    // ── Employee Company (currency/display only; no operating-company switcher) ─

    getCompanies: (): Promise<{
        companies: { id: number; name: string; currency: { id: number; symbol: string; position: 'before' | 'after' } | null }[];
        default_company_id: number | null;
    }> => apiFetch('/companies'),

    // Options for a dynamic many2one custom field. The relation target is
    // resolved server-side from (source_model, field); supports name search.
    getRelationOptions: (
        sourceModel: string,
        field: string,
        search = '',
    ): Promise<{ options: { id: number; name: string }[] }> =>
        apiFetch(
            `/options?source_model=${encodeURIComponent(sourceModel)}&field=${encodeURIComponent(field)}` +
                (search ? `&search=${encodeURIComponent(search)}` : '')
        ),

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
        custom_values?: Record<string, any>;
        attachments?: Attachment[];
    }) =>
        apiFetch('/time-off', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTimeOffFormSchema: (): Promise<{ custom_fields: Record<string, any> }> =>
        apiFetch('/time-off/form-schema'),

    // ── Expenses ──────────────────────────────────────────────────────────────

    getExpenseProducts: () => apiFetch('/expenses/products'),

    getExpenseTaxes: () => apiFetch('/expenses/taxes'),

    getExpenseAnalyticAccounts: (): Promise<{ accounts: { id: number; name: string }[] }> =>
        apiFetch('/expenses/analytic-accounts'),

    getExpenseFormSchema: (): Promise<{ custom_fields: Record<string, any> }> =>
        apiFetch('/expenses/form-schema'),

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
        payment_mode?: 'own_account' | 'company_account';
        tax_ids?: number[];
        analytic_account_id?: number;
        custom_values?: Record<string, any>;
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
        custom_values?: Record<string, any>;
    }) =>
        apiFetch('/timesheet', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTimesheetFormSchema: (): Promise<{ custom_fields: Record<string, any> }> =>
        apiFetch('/timesheet/form-schema'),

    // ── Helpdesk ──────────────────────────────────────────────────────────────

    getHelpdeskTickets: (employeeId: number) =>
        apiFetch(`/helpdesk?employee_id=${employeeId}`),

    getHelpdeskTeams: () => apiFetch('/helpdesk/teams'),

    getHelpdeskTicketTypes: () => apiFetch('/helpdesk/ticket-types'),

    getHelpdeskTags: () => apiFetch('/helpdesk/tags'),

    getHelpdeskAgents: () => apiFetch('/helpdesk/agents'),

    getHelpdeskFormSchema: (): Promise<{ custom_fields: Record<string, any> }> =>
        apiFetch('/helpdesk/form-schema'),

    createHelpdeskTicket: (data: {
        employee_id: number;
        name: string;
        description?: string;
        team_id?: number;
        user_id?: number;
        priority?: '0' | '1' | '2' | '3';
        ticket_type_id?: number;
        tag_ids?: number[];
        custom_values?: Record<string, any>;
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

    getMaintenanceEquipment: () => apiFetch('/maintenance/equipment'),

    getMaintenanceTeams: () => apiFetch('/maintenance/teams'),

    getMaintenanceManufacturingOrders: () => apiFetch('/maintenance/manufacturing-orders'),

    getMaintenanceFormSchema: (): Promise<{ custom_fields: Record<string, any> }> =>
        apiFetch('/maintenance/form-schema'),

    createMaintenanceRequest: (data: {
        employee_id: number;
        name: string;
        description?: string;
        category_id?: number;
        maintenance_type?: 'corrective' | 'preventive';
        equipment_id?: number;
        maintenance_team_id?: number;
        schedule_date?: string;
        schedule_end?: string;
        request_date?: string;
        recurring?: boolean;
        production_id?: number;
        duration?: number;
        priority?: '0' | '1' | '2' | '3';
        custom_values?: Record<string, any>;
        attachments?: Attachment[];
    }): Promise<{
        status?: string;
        id?: number;
        available?: boolean;
        partial_success?: boolean;
        failed_attachments?: string[];
        dropped_fields?: string[];
    }> =>
        apiFetch('/maintenance', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // ── Attendance ────────────────────────────────────────────────────────────

    getAttendanceHistory: (employeeId: number) =>
        apiFetch(`/attendance?employee_id=${employeeId}`),

    getAttendanceOvertime: (employeeId: number) =>
        apiFetch(`/attendance/overtime?employee_id=${employeeId}`),

    getAttendanceFormSchema: (): Promise<{
        correction: { custom_fields: Record<string, any> };
        overtime: { custom_fields: Record<string, any> };
        justification: { custom_fields: Record<string, any> };
    }> =>
        apiFetch('/attendance/form-schema'),

    createAttendanceCorrection: (data: {
        employee_id: number;
        check_in: string;
        check_out?: string;
        reason?: string;
        custom_values?: Record<string, any>;
        attachments?: Attachment[];
    }) =>
        apiFetch('/attendance/correction', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Overtime and justification are retained for API compatibility; the current
    // mobile UI only submits check-in/out corrections.
    createAttendanceOvertime: (data: {
        employee_id: number;
        date: string;
        duration: number;
        reason?: string;
        custom_values?: Record<string, any>;
    }) =>
        apiFetch('/attendance/overtime', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    createAttendanceJustification: (data: {
        employee_id: number;
        leave_type_id: number;
        date_from: string;
        date_to: string;
        justification: string;
        custom_values?: Record<string, any>;
        attachments?: Attachment[];
    }) =>
        apiFetch('/attendance/justification', {
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
