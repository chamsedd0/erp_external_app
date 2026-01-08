import { API_URL } from '../constants';

export const apiClient = {
    // Auth
    login: async (employee_id: string, pin: string) => {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id, pin }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Login failed' }));
            throw new Error(error.error || 'Login failed');
        }
        return await response.json();
    },

    // Time Off
    getTimeOffTypes: async () => {
        const response = await fetch(`${API_URL}/time-off/types`);
        if (!response.ok) throw new Error('Failed to fetch leave types');
        return await response.json();
    },

    getTimeOffRequests: async (employeeId: number) => {
        const response = await fetch(`${API_URL}/time-off?employee_id=${employeeId}`);
        if (!response.ok) throw new Error('Failed to fetch time-off requests');
        return await response.json();
    },

    createTimeOffRequest: async (data: {
        employee_id: number;
        holiday_status_id: number;
        date_from: string;
        date_to: string;
        name?: string;
    }) => {
        const response = await fetch(`${API_URL}/time-off`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create request' }));
            throw new Error(error.error || 'Failed to create time-off request');
        }
        return await response.json();
    },

    // Expenses
    getExpenseProducts: async () => {
        const response = await fetch(`${API_URL}/expenses/products`);
        if (!response.ok) throw new Error('Failed to fetch expense products');
        return await response.json();
    },

    getExpenses: async (employeeId: number) => {
        const response = await fetch(`${API_URL}/expenses?employee_id=${employeeId}`);
        if (!response.ok) throw new Error('Failed to fetch expenses');
        return await response.json();
    },

    // Pending requests for dashboard
    getPendingTimeOff: async () => {
        const response = await fetch(`${API_URL}/time-off/pending`);
        if (!response.ok) throw new Error('Failed to fetch pending time-off');
        return await response.json();
    },

    getPendingExpenses: async () => {
        const response = await fetch(`${API_URL}/expenses/pending`);
        if (!response.ok) throw new Error('Failed to fetch pending expenses');
        return await response.json();
    },

    createExpense: async (data: {
        employee_id: number;
        product_id: number;
        name: string;
        unit_amount: number;
        quantity: number;
        date: string;
        receipt?: string;
    }) => {
        const response = await fetch(`${API_URL}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create expense' }));
            throw new Error(error.error || 'Failed to create expense');
        }
        return await response.json();
    },
};
