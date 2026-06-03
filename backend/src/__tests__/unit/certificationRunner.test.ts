import { runTenantCertification, sanitizeForCertification } from '../../lib/certificationRunner';
import { getOdooClient } from '../../odoo/client';
import { getCustomFieldReport } from '../../lib/schemaCache';
import { SAMPLE_TENANT } from '../routes/helpers';

jest.mock('../../odoo/client');
jest.mock('../../lib/schemaCache');

const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;
const mockGetCustomFieldReport = getCustomFieldReport as jest.MockedFunction<typeof getCustomFieldReport>;

function makeClient() {
    return {
        authenticate: jest.fn().mockResolvedValue(1),
        getVersion: jest.fn().mockResolvedValue(17),
        getSchema: jest.fn().mockResolvedValue({ id: { string: 'ID', type: 'integer', required: false } }),
        searchEmployee: jest.fn().mockResolvedValue([{ id: 42, name: 'Alice', company_id: [1, 'Main'], work_email: 'alice@test.com' }]),
        searchRead: jest.fn(async (_uid: number, model: string) => {
            if (model === 'res.company') return [{ id: 1, name: 'Main' }, { id: 2, name: 'Other' }];
            if (model === 'hr.employee') return [{ id: 42, name: 'Alice', company_id: [1, 'Main'], work_email: 'alice@test.com' }];
            if (model === 'product.product') return [{ id: 5, name: 'Travel', company_id: false }];
            if (model === 'hr.leave.type') return [{ id: 6, name: 'Annual' }];
            return [];
        }),
        createRecord: jest.fn(),
        writeRecord: jest.fn(),
        uploadAttachments: jest.fn(),
        callMethod: jest.fn(),
        createAttachment: jest.fn(),
    };
}

const EMPTY_REPORT = {
    custom_fields: {},
    schema_available: true,
    unsupported_fields: {},
    unsupported_required_fields: {},
    schema_cached_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
    jest.clearAllMocks();
    mockGetCustomFieldReport.mockResolvedValue(EMPTY_REPORT);
});

describe('certification runner', () => {
    it('redacts credentials and binary payloads from stored details', () => {
        const sanitized = sanitizeForCertification({
            pin: '1234',
            barcode: 'EMP007',
            token: 'secret-token',
            nested: { datas: 'base64payload', ok: 'visible' },
        });

        expect(sanitized).toEqual({
            pin: '[REDACTED]',
            barcode: '[REDACTED]',
            token: '[REDACTED]',
            nested: { datas: '[REDACTED]', ok: 'visible' },
        });
    });

    it('safe mode does not call create, write, or upload paths', async () => {
        const client = makeClient();
        mockGetOdooClient.mockReturnValue(client as any);

        const run = await runTenantCertification('testcorp', SAMPLE_TENANT, {
            mode: 'safe',
            employees: [{ identifier: 'EMP007', pin: '1234', login_method: 'barcode_pin' }],
            options: { include_optional_modules: false, include_wrong_company_tests: true, include_attachments: true },
        });

        expect(run.status).toBe('pass');
        expect(client.createRecord).not.toHaveBeenCalled();
        expect(client.writeRecord).not.toHaveBeenCalled();
        expect(client.uploadAttachments).not.toHaveBeenCalled();
        expect(JSON.stringify(run)).not.toContain('1234');
        expect(JSON.stringify(run)).not.toContain('EMP007');
    });

    it('unsupported required custom fields create a blocking failure', async () => {
        const client = makeClient();
        mockGetOdooClient.mockReturnValue(client as any);
        mockGetCustomFieldReport.mockImplementation(async (_tenant, _client, _uid, model) => ({
            ...EMPTY_REPORT,
            unsupported_fields: model === 'hr.expense'
                ? { x_binary_required: { string: 'Binary Required', type: 'binary', required: true } }
                : {},
            unsupported_required_fields: model === 'hr.expense'
                ? { x_binary_required: { string: 'Binary Required', type: 'binary', required: true } }
                : {},
        } as any));

        const run = await runTenantCertification('testcorp', SAMPLE_TENANT, {
            mode: 'safe',
            employees: [{ identifier: 'EMP007', pin: '1234', login_method: 'barcode_pin' }],
            options: { include_optional_modules: false, include_wrong_company_tests: false, include_attachments: false },
        });

        expect(run.status).toBe('fail');
        expect(run.summary.blocking_failures).toBeGreaterThan(0);
        expect(run.scenarios.find(s => s.id === 'schema.hr.expense')?.message).toContain('Unsupported required custom fields');
    });
});
