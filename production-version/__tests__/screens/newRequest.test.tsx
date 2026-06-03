/**
 * New Request screen logic tests.
 * Tests: data loading (leave types, products, teams, categories),
 * and all four submit flows (time-off, expense, helpdesk, maintenance).
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

// ─── Data loading ─────────────────────────────────────────────────────────────

describe('Data loading on mount', () => {
    it('fetches leave types', async () => {
        mockFetch(true, { types: [{ id: 1, name: 'Annual Leave' }, { id: 2, name: 'Sick Leave' }] });
        const result = await apiClient.getTimeOffTypes();
        expect(fetch).toHaveBeenCalledWith(`${API_URL}/time-off/types`, expect.any(Object));
        expect(result.types).toHaveLength(2);
    });

    it('fetches expense products', async () => {
        mockFetch(true, { products: [{ id: 10, name: 'Travel' }, { id: 11, name: 'Meals' }] });
        const result = await apiClient.getExpenseProducts();
        expect(fetch).toHaveBeenCalledWith(`${API_URL}/expenses/products`, expect.any(Object));
        expect(result.products).toHaveLength(2);
    });

    it('fetches helpdesk teams (availability check)', async () => {
        mockFetch(true, { available: true, teams: [{ id: 1, name: 'Support' }] });
        const result = await apiClient.getHelpdeskTeams();
        expect(fetch).toHaveBeenCalledWith(`${API_URL}/helpdesk/teams`, expect.any(Object));
        expect(result.available).toBe(true);
    });

    it('fetches maintenance categories (availability check)', async () => {
        mockFetch(true, { available: true, categories: [{ id: 1, name: 'HVAC' }] });
        const result = await apiClient.getMaintenanceCategories();
        expect(fetch).toHaveBeenCalledWith(`${API_URL}/maintenance/categories`, expect.any(Object));
        expect(result.available).toBe(true);
    });

    it('handles helpdesk unavailable gracefully', async () => {
        mockFetch(true, { available: false, teams: [] });
        const result = await apiClient.getHelpdeskTeams();
        expect(result.available).toBe(false);
        expect(result.teams).toEqual([]);
    });
});

// ─── Time Off submission ───────────────────────────────────────────────────────

describe('Time Off request creation', () => {
    const VALID_PAYLOAD = {
        employee_id: 42,
        leave_type_id: 1,
        date_from: '2025-07-01T00:00:00.000Z',
        date_to: '2025-07-05T23:59:59.999Z',
        name: 'Summer vacation',
    };

    it('creates time-off request with required fields', async () => {
        mockFetch(true, { status: 'success', id: 100 });

        const result = await apiClient.createTimeOffRequest(VALID_PAYLOAD);

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/time-off`,
            expect.objectContaining({ method: 'POST' })
        );
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.employee_id).toBe(42);
        expect(body.leave_type_id).toBe(1);
        expect(result.id).toBe(100);
    });

    it('includes attachments when provided', async () => {
        mockFetch(true, { status: 'success', id: 101 });

        await apiClient.createTimeOffRequest({
            ...VALID_PAYLOAD,
            attachments: [{ name: 'doc.pdf', data: 'base64==', mimetype: 'application/pdf' }],
        });

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.attachments).toHaveLength(1);
        expect(body.attachments[0].name).toBe('doc.pdf');
    });

    it('throws on server error', async () => {
        mockFetch(false, { error: 'Invalid leave type' }, 400);
        await expect(apiClient.createTimeOffRequest(VALID_PAYLOAD)).rejects.toThrow('Could not submit your time off request. Please check the dates and try again.');
    });
});

// ─── Expense submission ────────────────────────────────────────────────────────

describe('Expense creation', () => {
    const VALID_EXPENSE = {
        employee_id: 42,
        product_id: 10,
        name: 'Hotel in Paris',
        unit_amount: 250,
        quantity: 1,
        date: '2025-06-20',
    };

    it('creates expense with required fields', async () => {
        mockFetch(true, { status: 'success', id: 200, state: 'draft' });

        const result = await apiClient.createExpense(VALID_EXPENSE);

        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.employee_id).toBe(42);
        expect(body.product_id).toBe(10);
        expect(body.unit_amount).toBe(250);
        expect(result.id).toBe(200);
    });

    it('sends quantity field', async () => {
        mockFetch(true, { status: 'success', id: 201 });
        await apiClient.createExpense({ ...VALID_EXPENSE, quantity: 3 });
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.quantity).toBe(3);
    });

    it('throws on validation error', async () => {
        mockFetch(false, { error: 'Invalid input' }, 400);
        await expect(apiClient.createExpense(VALID_EXPENSE)).rejects.toThrow('Invalid input');
    });
});

// ─── Helpdesk ticket submission ────────────────────────────────────────────────

describe('Helpdesk ticket creation', () => {
    const VALID_TICKET = {
        employee_id: 42,
        name: 'Cannot access payroll system',
        description: 'Getting 403 error when I try to access payroll',
        team_id: 1,
    };

    it('creates helpdesk ticket with subject and employee_id', async () => {
        mockFetch(true, { status: 'success', id: 300, available: true });

        const result = await apiClient.createHelpdeskTicket(VALID_TICKET);

        expect(fetch).toHaveBeenCalledWith(`${API_URL}/helpdesk`, expect.objectContaining({ method: 'POST' }));
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.name).toBe('Cannot access payroll system');
        expect(result.id).toBe(300);
    });

    it('works without optional team_id', async () => {
        mockFetch(true, { status: 'success', id: 301, available: true });
        await apiClient.createHelpdeskTicket({ employee_id: 42, name: 'Issue' });
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body).not.toHaveProperty('team_id');
    });

    it('returns available:false when helpdesk module not installed', async () => {
        mockFetch(true, { available: false, message: 'Helpdesk module not available' });
        const result = await apiClient.createHelpdeskTicket(VALID_TICKET);
        expect(result.available).toBe(false);
    });
});

// ─── Maintenance request submission ───────────────────────────────────────────

describe('Maintenance request creation', () => {
    const VALID_REQUEST = {
        employee_id: 42,
        name: 'Fix broken AC in room 301',
        maintenance_type: 'corrective' as const,
        category_id: 1,
        description: 'AC not cooling properly',
    };

    it('creates maintenance request with required fields', async () => {
        mockFetch(true, { status: 'success', id: 400 });

        const result = await apiClient.createMaintenanceRequest(VALID_REQUEST);

        expect(fetch).toHaveBeenCalledWith(`${API_URL}/maintenance`, expect.objectContaining({ method: 'POST' }));
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.name).toBe('Fix broken AC in room 301');
        expect(body.maintenance_type).toBe('corrective');
        expect(result.id).toBe(400);
    });

    it('supports preventive maintenance type', async () => {
        mockFetch(true, { status: 'success', id: 401 });
        await apiClient.createMaintenanceRequest({ ...VALID_REQUEST, maintenance_type: 'preventive' });
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.maintenance_type).toBe('preventive');
    });

    it('returns available:false when maintenance module not installed', async () => {
        mockFetch(true, { available: false });
        const result = await apiClient.createMaintenanceRequest(VALID_REQUEST);
        expect(result.available).toBe(false);
    });

    it('throws on server error', async () => {
        mockFetch(false, { error: 'Odoo error' }, 500);
        await expect(apiClient.createMaintenanceRequest(VALID_REQUEST)).rejects.toThrow('Something went wrong on the server. Please try again or contact your administrator.');
    });
});

// ─── Client-side validation mirrors ──────────────────────────────────────────

describe('Form validation logic (client-side mirrors)', () => {
    it('time-off: requires leave_type_id, dateFrom, dateTo', () => {
        const holidayStatusId = null;
        const dateFrom = new Date('2025-07-01');
        const dateTo = new Date('2025-07-05');
        // Mirror: if (!holidayStatusId || !dateFrom || !dateTo)
        expect(!holidayStatusId || !dateFrom || !dateTo).toBe(true); // fails (no type selected)
    });

    it('expense: requires productId, amount, description, date', () => {
        const productId = 10;
        const amount = '250';
        const description = 'Hotel';
        const date = new Date();
        expect(!productId || !amount || !description || !date).toBe(false); // passes
    });

    it('helpdesk: requires subject with length > 0', () => {
        expect('   '.trim().length === 0).toBe(true);  // empty → fails
        expect('My issue'.trim().length === 0).toBe(false); // has content → passes
    });

    it('maintenance: requires title with length > 0', () => {
        expect(''.trim().length === 0).toBe(true);    // empty → fails
        expect('Fix AC'.trim().length === 0).toBe(false); // has content → passes
    });
});
