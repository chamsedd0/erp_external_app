/**
 * Shared test helpers for route tests.
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface TokenPayload {
    id?: number;
    name?: string;
    role?: string;
    tenantId?: string;
}

/** Sign a test JWT with the test secret. */
export function signToken(payload: TokenPayload = {}): string {
    return jwt.sign(
        { id: 42, name: 'Test User', role: 'employee', tenantId: 'testcorp', ...payload },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

/** Convenience: auth header value. */
export function authHeader(payload: TokenPayload = {}): string {
    return `Bearer ${signToken(payload)}`;
}

/** Full SAMPLE_TENANT including all new admin/billing fields. */
export const SAMPLE_TENANT = {
    name: 'Test Corp',
    hr_email: 'hr@testcorp.com',
    odoo_url: 'https://test.odoo.com',
    odoo_db: 'testdb',
    odoo_username: 'admin@test.com',
    odoo_password: 'password',

    contact_name: 'Alice Manager',
    contact_email: 'alice@testcorp.com',
    contact_phone: '+1 555 000 0000',

    subscription_plan: 'professional' as const,
    subscription_status: 'active' as const,
    subscription_start: '2025-01-01',
    subscription_renewal: '2026-06-01',
    monthly_amount: 299,

    enabled: true,
    created_at: '2025-01-01T00:00:00.000Z',
    notes: 'Test tenant',
};

export function makeMockOdooClient(overrides: Record<string, any> = {}) {
    return {
        authenticate: jest.fn().mockResolvedValue(1),
        searchEmployee: jest.fn().mockResolvedValue([]),
        searchRead: jest.fn().mockResolvedValue([]),
        createRecord: jest.fn().mockResolvedValue(99),
        writeRecord: jest.fn().mockResolvedValue(true),
        uploadAttachments: jest.fn().mockResolvedValue(undefined),
        callMethod: jest.fn().mockResolvedValue(true),
        getVersion: jest.fn().mockResolvedValue(16),
        getSchema: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}
