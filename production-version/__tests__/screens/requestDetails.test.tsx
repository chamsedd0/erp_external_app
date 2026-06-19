/**
 * Request Details screen logic tests.
 * Tests: fetching request details for all 5 request types,
 * and the helper functions for status, color, and label resolution.
 */

jest.mock('@react-native-async-storage/async-storage');

import { apiClient } from '../../api/client';

const API_URL = 'https://erp-external-app.vercel.app';

function mockFetch(ok: boolean, body: any, status = 200) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

beforeEach(() => jest.clearAllMocks());

// ─── Request fetching per type ─────────────────────────────────────────────────

describe('Fetching time-off requests', () => {
    const LEAVES = [
        { id: 10, leave_type_id: [1, 'Annual Leave'], date_from: '2025-07-01 00:00:00', date_to: '2025-07-05 00:00:00', number_of_days: 5, state: 'validate', name: 'Summer holiday' },
        { id: 11, leave_type_id: [2, 'Sick Leave'], date_from: '2025-07-10 00:00:00', date_to: '2025-07-10 00:00:00', number_of_days: 1, state: 'draft', name: 'Not feeling well' },
    ];

    it('fetches time-off list and finds by id', async () => {
        mockFetch(true, { leaves: LEAVES });
        const result = await apiClient.getTimeOffRequests(42);
        const found = result.leaves.find((l: any) => l.id === 10);
        expect(found).toBeTruthy();
        expect(found.state).toBe('validate');
    });

    it('returns all leaves for the employee', async () => {
        mockFetch(true, { leaves: LEAVES });
        const result = await apiClient.getTimeOffRequests(42);
        expect(result.leaves).toHaveLength(2);
    });
});

describe('Fetching expense requests', () => {
    const EXPENSES = [
        { id: 20, name: 'Hotel Paris', product_id: [10, 'Travel'], price_unit: 250, total_amount: 250, state: 'reported', date: '2025-06-20' },
    ];

    it('fetches expenses list', async () => {
        mockFetch(true, { expenses: EXPENSES });
        const result = await apiClient.getExpenses(42);
        expect(result.expenses).toHaveLength(1);
        expect(result.expenses[0].id).toBe(20);
    });
});

describe('Fetching timesheet entries', () => {
    it('fetches timesheet entries for employee', async () => {
        mockFetch(true, {
            entries: [
                { id: 30, name: 'Implemented auth', project_id: [1, 'Project Alpha'], task_id: [10, 'Auth task'], date: '2025-06-15', unit_amount: 3 },
            ],
        });
        const result = await apiClient.getTimesheetEntries(42);
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].unit_amount).toBe(3);
    });
});

describe('Fetching helpdesk tickets', () => {
    it('fetches tickets for employee', async () => {
        mockFetch(true, {
            available: true,
            tickets: [
                { id: 40, name: 'Cannot login', stage_id: [1, 'New'], team_id: [1, 'Support'], create_date: '2025-06-10 10:00:00' },
            ],
        });
        const result = await apiClient.getHelpdeskTickets(42);
        expect(result.available).toBe(true);
        expect(result.tickets).toHaveLength(1);
    });

    it('returns available:false when helpdesk not installed', async () => {
        mockFetch(true, { available: false, tickets: [] });
        const result = await apiClient.getHelpdeskTickets(42);
        expect(result.available).toBe(false);
    });
});

describe('Fetching maintenance requests', () => {
    it('fetches maintenance requests for employee', async () => {
        mockFetch(true, {
            requests: [
                { id: 50, name: 'Fix AC', stage_id: [1, 'New'], maintenance_type: 'corrective', create_date: '2025-06-05 08:00:00' },
            ],
        });
        const result = await apiClient.getMaintenanceRequests(42);
        expect(result.requests).toHaveLength(1);
        expect(result.requests[0].maintenance_type).toBe('corrective');
    });
});

// ─── Status resolution logic ──────────────────────────────────────────────────

describe('Status resolution (mirrors getStatusConfig)', () => {
    // Mirrors the getStatusConfig function in request-details.tsx

    function getStatusConfig(req: any) {
        const stateStr: string = req.state
            ? String(req.state)
            : Array.isArray(req.stage_id) ? String(req.stage_id[1]) : '';

        if (['validate', 'validate1', 'done', 'approved'].includes(stateStr)) {
            return { label: 'Approved', icon: 'CheckCircle', color: 'success' };
        }
        if (['refuse', 'refused', 'rejected', 'cancelled'].includes(stateStr)) {
            return { label: 'Rejected', icon: 'XCircle', color: 'error' };
        }
        return { label: stateStr || 'Pending', icon: 'AlertCircle', color: 'warning' };
    }

    it('resolves "validate" state as Approved', () => {
        expect(getStatusConfig({ state: 'validate' }).label).toBe('Approved');
    });

    it('resolves "done" state as Approved', () => {
        expect(getStatusConfig({ state: 'done' }).label).toBe('Approved');
    });

    it('resolves "refuse" state as Rejected', () => {
        expect(getStatusConfig({ state: 'refuse' }).label).toBe('Rejected');
    });

    it('resolves "refused" state as Rejected', () => {
        expect(getStatusConfig({ state: 'refused' }).label).toBe('Rejected');
    });

    it('resolves "draft" state as Pending', () => {
        const config = getStatusConfig({ state: 'draft' });
        expect(config.icon).toBe('AlertCircle');
    });

    it('uses stage_id[1] for helpdesk/maintenance requests', () => {
        const config = getStatusConfig({ stage_id: [1, 'In Progress'] });
        expect(config.label).toBe('In Progress');
    });
});

// ─── Label resolution logic ───────────────────────────────────────────────────

describe('Type label resolution (mirrors labelForType)', () => {
    function labelForType(type: string) {
        switch (type) {
            case 'timeoff': return 'Time Off Request';
            case 'expense': return 'Expense Claim';
            case 'timesheet': return 'Timesheet Entry';
            case 'helpdesk': return 'Helpdesk Ticket';
            case 'maintenance': return 'Maintenance Request';
            default: return 'Request';
        }
    }

    it('returns correct label for each type', () => {
        expect(labelForType('timeoff')).toBe('Time Off Request');
        expect(labelForType('expense')).toBe('Expense Claim');
        expect(labelForType('timesheet')).toBe('Timesheet Entry');
        expect(labelForType('helpdesk')).toBe('Helpdesk Ticket');
        expect(labelForType('maintenance')).toBe('Maintenance Request');
    });

    it('returns generic label for unknown type', () => {
        expect(labelForType('unknown')).toBe('Request');
    });
});

// ─── Title extraction logic ───────────────────────────────────────────────────

describe('Title extraction (mirrors titleForRequest)', () => {
    function titleForRequest(type: string, req: any): string {
        if (type === 'timeoff') {
            return Array.isArray(req.leave_type_id) ? req.leave_type_id[1] : req.name || 'Time Off';
        }
        return req.name || 'Untitled';
    }

    it('extracts leave type name for time-off', () => {
        const req = { leave_type_id: [1, 'Annual Leave'], name: 'My leave' };
        expect(titleForRequest('timeoff', req)).toBe('Annual Leave');
    });

    it('falls back to name when leave_type_id is not an array', () => {
        const req = { leave_type_id: false, name: 'Sick day' };
        expect(titleForRequest('timeoff', req)).toBe('Sick day');
    });

    it('uses name field for expense/helpdesk/maintenance', () => {
        expect(titleForRequest('expense', { name: 'Hotel Paris' })).toBe('Hotel Paris');
        expect(titleForRequest('helpdesk', { name: 'Login issue' })).toBe('Login issue');
        expect(titleForRequest('maintenance', { name: 'Fix AC' })).toBe('Fix AC');
    });
});
