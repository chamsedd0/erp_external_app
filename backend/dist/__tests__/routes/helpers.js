"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAMPLE_TENANT = void 0;
exports.signToken = signToken;
exports.authHeader = authHeader;
exports.makeMockOdooClient = makeMockOdooClient;
/**
 * Shared test helpers for route tests.
 */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
/** Sign a test JWT with the test secret. */
function signToken(payload = {}) {
    return jsonwebtoken_1.default.sign({ id: 42, name: 'Test User', role: 'employee', tenantId: 'testcorp', ...payload }, JWT_SECRET, { expiresIn: '1h' });
}
/** Convenience: auth header value. */
function authHeader(payload = {}) {
    return `Bearer ${signToken(payload)}`;
}
/** Full SAMPLE_TENANT including all new admin/billing fields. */
exports.SAMPLE_TENANT = {
    name: 'Test Corp',
    hr_email: 'hr@testcorp.com',
    odoo_url: 'https://test.odoo.com',
    odoo_db: 'testdb',
    odoo_username: 'admin@test.com',
    odoo_password: 'password',
    contact_name: 'Alice Manager',
    contact_email: 'alice@testcorp.com',
    contact_phone: '+1 555 000 0000',
    subscription_plan: 'professional',
    subscription_status: 'active',
    subscription_start: '2025-01-01',
    subscription_renewal: '2026-06-01',
    monthly_amount: 299,
    enabled: true,
    created_at: '2025-01-01T00:00:00.000Z',
    notes: 'Test tenant',
};
function makeMockOdooClient(overrides = {}) {
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
