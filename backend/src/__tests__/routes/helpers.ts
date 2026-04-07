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

export const SAMPLE_TENANT = {
    name: 'Test Corp',
    hr_email: 'hr@testcorp.com',
    odoo_url: 'https://test.odoo.com',
    odoo_db: 'testdb',
    odoo_username: 'admin@test.com',
    odoo_password: 'password',
};

export function makeMockOdooClient(overrides: Record<string, any> = {}) {
    return {
        authenticate: jest.fn().mockResolvedValue(1),
        searchEmployee: jest.fn().mockResolvedValue([]),
        searchRead: jest.fn().mockResolvedValue([]),
        createRecord: jest.fn().mockResolvedValue(99),
        writeRecord: jest.fn().mockResolvedValue(true),
        uploadAttachments: jest.fn().mockResolvedValue(undefined),
        getVersion: jest.fn().mockResolvedValue(16),
        getSchema: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
}
