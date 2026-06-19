"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_EMPLOYEE_COMPANY_ID = exports.SAMPLE_TENANT = void 0;
exports.signToken = signToken;
exports.authHeader = authHeader;
exports.makeMockOdooClient = makeMockOdooClient;
exports.mockSearchReadByModel = mockSearchReadByModel;
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
/**
 * Default employee company id resolved by company-scoped read/write contexts
 * (buildReadContext / buildOdooContext) via their internal hr.employee lookup.
 */
exports.TEST_EMPLOYEE_COMPANY_ID = 1;
function makeMockOdooClient(overrides = {}) {
    const client = {
        authenticate: jest.fn().mockResolvedValue(1),
        searchEmployee: jest.fn().mockResolvedValue([]),
        // Argument-aware default: resolve the employee-company lookup that the
        // validated context helpers perform (hr.employee[company_id]) so create
        // routes are company-scoped without each test mocking it. Everything
        // else defaults to []. Per-call mockResolvedValueOnce still overrides.
        searchRead: jest.fn().mockImplementation(async (_uid, model, _domain = [], fields = []) => {
            if (model === 'hr.employee' && Array.isArray(fields) && fields.includes('company_id')) {
                return [{ id: 42, company_id: [exports.TEST_EMPLOYEE_COMPANY_ID, 'Test Co'] }];
            }
            return [];
        }),
        createRecord: jest.fn().mockResolvedValue(99),
        writeRecord: jest.fn().mockResolvedValue(true),
        uploadAttachments: jest.fn().mockResolvedValue({ uploaded: 0, failed: [] }),
        callMethod: jest.fn().mockResolvedValue(true),
        getVersion: jest.fn().mockResolvedValue(16),
        getSchema: jest.fn().mockResolvedValue({}),
        ...overrides,
    };
    return client;
}
/**
 * Configure `client.searchRead` to dispatch by Odoo model name instead of
 * positional `mockResolvedValueOnce` queues. This is order-independent, so it
 * survives the implicit `hr.employee` company lookup that company-scoped reads
 * now perform.
 *
 * - `hr.employee` company lookups resolve to TEST_EMPLOYEE_COMPANY_ID by default
 *   (override via opts.employeeCompanyId; pass null to simulate "no company").
 * - Any model without a handler resolves to `[]`.
 * - A handler may return a value or throw (to simulate Odoo errors); throwing
 *   functions reject the promise.
 */
function mockSearchReadByModel(mockClient, handlers, opts = {}) {
    const companyId = opts.employeeCompanyId === undefined ? exports.TEST_EMPLOYEE_COMPANY_ID : opts.employeeCompanyId;
    mockClient.searchRead.mockImplementation(async (_uid, model, domain = [], fields = []) => {
        if (model === 'hr.employee' && fields.includes('company_id')) {
            return companyId == null ? [] : [{ id: 42, company_id: [companyId, 'Test Co'] }];
        }
        const handler = handlers[model];
        if (!handler)
            return [];
        return handler(domain, fields);
    });
}
