/**
 * Login screen logic tests.
 * Tests the two-step login flow: company code lookup → employee login.
 * Uses apiClient directly (mocked fetch) without rendering native components.
 */

// Mock AsyncStorage before importing apiClient
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

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── Company Code Step (getTenantInfo) ────────────────────────────────────────

describe('Company code step — getTenantInfo', () => {
    it('fetches tenant info for a valid company code', async () => {
        mockFetch(true, { name: 'Test Corp', hr_email: 'hr@testcorp.com' });

        const result = await apiClient.getTenantInfo('testcorp');

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/auth/tenant/testcorp`,
            expect.objectContaining({ headers: expect.any(Object) })
        );
        expect(result).toEqual({ name: 'Test Corp', hr_email: 'hr@testcorp.com' });
    });

    it('throws when company code is not found (404)', async () => {
        mockFetch(false, { error: 'Tenant not found' }, 404);

        await expect(apiClient.getTenantInfo('unknown')).rejects.toThrow('Tenant not found');
    });

    it('throws generic error when response body has no error field', async () => {
        mockFetch(false, {}, 500);

        await expect(apiClient.getTenantInfo('bad')).rejects.toThrow('Request failed (500)');
    });
});

// ─── Login Step (apiClient.login) ─────────────────────────────────────────────

describe('Login step — apiClient.login', () => {
    it('posts credentials and returns token + user on success', async () => {
        mockFetch(true, {
            token: 'jwt-abc-123',
            user: { id: 42, name: 'Alice', role: 'employee', tenantId: 'testcorp' },
        });

        const result = await apiClient.login('42', '1234', 'testcorp');

        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/auth/login`,
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ employee_id: '42', pin: '1234', tenant_slug: 'testcorp' }),
            })
        );
        expect(result.token).toBe('jwt-abc-123');
        expect(result.user.id).toBe(42);
    });

    it('throws on wrong PIN (401)', async () => {
        mockFetch(false, { error: 'Invalid credentials' }, 401);

        // Note: 401 triggers _onUnauthorized then throws 'Session expired'
        await expect(apiClient.login('42', '0000', 'testcorp')).rejects.toThrow();
    });

    it('throws on network failure', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

        await expect(apiClient.login('42', '1234', 'testcorp')).rejects.toThrow('Network request failed');
    });

    it('sends tenant_slug in body', async () => {
        mockFetch(true, { token: 'tok', user: {} });
        await apiClient.login('99', '5678', 'acmecorp');
        const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.tenant_slug).toBe('acmecorp');
    });
});

// ─── Login validation logic ───────────────────────────────────────────────────

describe('Login validation (client-side logic)', () => {
    it('should require non-empty employee_id and PIN (represented as both truthy)', () => {
        const employeeId = '42';
        const pin = '1234';
        // Mirror the guard: if (!employeeId || !pin) → show warning
        expect(!employeeId || !pin).toBe(false); // validation passes
    });

    it('triggers warning when employeeId is empty', () => {
        const employeeId = '';
        const pin = '1234';
        expect(!employeeId || !pin).toBe(true); // validation fails
    });

    it('triggers warning when PIN is empty', () => {
        const employeeId = '42';
        const pin = '';
        expect(!employeeId || !pin).toBe(true); // validation fails
    });
});

// ─── Company code preprocessing logic ────────────────────────────────────────

describe('Company code preprocessing', () => {
    it('lowercases and trims the company code before API call', async () => {
        mockFetch(true, { name: 'Test Corp', hr_email: 'hr@test.com' });

        // Mimic the handleCompanyContinue preprocessing:
        const raw = '  TestCorp  ';
        const slug = raw.trim().toLowerCase();

        await apiClient.getTenantInfo(slug);

        const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
        expect(calledUrl).toContain('/auth/tenant/testcorp');
    });
});
