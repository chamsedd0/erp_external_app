import request from 'supertest';
import app from '../../index';
import { tenantStore } from '../../lib/tenantStore';
import { getOdooClient } from '../../odoo/client';
import { authHeader, SAMPLE_TENANT, makeMockOdooClient } from './helpers';

jest.mock('../../lib/tenantStore');
jest.mock('../../odoo/client');

const mockTenantStore = tenantStore as jest.Mocked<typeof tenantStore>;
const mockGetOdooClient = getOdooClient as jest.MockedFunction<typeof getOdooClient>;

let mockClient: ReturnType<typeof makeMockOdooClient>;

beforeEach(() => {
    jest.clearAllMocks();
    mockClient = makeMockOdooClient();
    mockTenantStore.getTenant.mockResolvedValue(SAMPLE_TENANT);
    mockGetOdooClient.mockReturnValue(mockClient as any);
});

// /options resolves the relation from the source model's schema, then reads the
// relation model. getSchema is keyed by model so we can drive both.
function setupSchema(perModel: Record<string, Record<string, any>>) {
    mockClient.getSchema.mockImplementation(async (_uid: number, model: string) => perModel[model] ?? {});
}

describe('GET /options — company scoping', () => {
    it('applies an explicit company domain when the relation model has company_id', async () => {
        setupSchema({
            'hr.expense': { x_studio_ispc: { type: 'many2one', relation: 'account.analytic.account', string: 'ISPC' } },
            'account.analytic.account': { company_id: { type: 'many2one', relation: 'res.company', string: 'Company' } },
        });
        let seenDomain: any[] = [];
        mockClient.searchRead.mockImplementation(async (_uid: number, model: string, domain: any[] = [], fields: string[] = []) => {
            if (model === 'hr.employee' && fields.includes('company_id')) {
                return [{ id: 42, company_id: [1, 'Test Co'] }];
            }
            if (model === 'account.analytic.account') {
                seenDomain = domain;
                return [{ id: 5, display_name: 'ISEC' }];
            }
            return [];
        });

        const res = await request(app)
            .get('/options?source_model=hr.expense&field=x_studio_ispc')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.options).toEqual([{ id: 5, name: 'ISEC' }]);
        expect(seenDomain).toEqual(expect.arrayContaining([
            ['company_id', '=', false],
            ['company_id', '=', 1],
        ]));
    });

    it('omits the company domain when the relation model has no company_id', async () => {
        setupSchema({
            'hr.expense': { x_partner: { type: 'many2one', relation: 'res.partner', string: 'Partner' } },
            'res.partner': { name: { type: 'char', string: 'Name' } }, // no company_id
        });
        let seenDomain: any[] = [];
        mockClient.searchRead.mockImplementation(async (_uid: number, model: string, domain: any[] = [], fields: string[] = []) => {
            if (model === 'hr.employee' && fields.includes('company_id')) {
                return [{ id: 42, company_id: [1, 'Test Co'] }];
            }
            if (model === 'res.partner') {
                seenDomain = domain;
                return [{ id: 7, display_name: 'ACME' }];
            }
            return [];
        });

        const res = await request(app)
            .get('/options?source_model=hr.expense&field=x_partner')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(seenDomain).not.toContainEqual(['company_id', '=', 1]);
    });

    it('rejects an unsupported source model', async () => {
        const res = await request(app)
            .get('/options?source_model=res.users&field=x_anything')
            .set('Authorization', authHeader());
        expect(res.status).toBe(400);
    });

    it('fails closed (empty options) when the relation schema cannot be determined', async () => {
        // Source schema resolves the relation, but the relation schema comes back
        // empty (RPC/cache failure). The route must NOT run an unscoped query.
        setupSchema({
            'hr.expense': { x_studio_ispc: { type: 'many2one', relation: 'account.analytic.account', string: 'ISPC' } },
            // 'account.analytic.account' intentionally absent → getSchema returns {}.
        });
        const relationReads = jest.fn();
        mockClient.searchRead.mockImplementation(async (_uid: number, model: string, _domain: any[] = [], fields: string[] = []) => {
            if (model === 'hr.employee' && fields.includes('company_id')) {
                return [{ id: 42, company_id: [1, 'Test Co'] }];
            }
            if (model === 'account.analytic.account') { relationReads(); return [{ id: 5, display_name: 'Leaked' }]; }
            return [];
        });

        const res = await request(app)
            .get('/options?source_model=hr.expense&field=x_studio_ispc')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.options).toEqual([]);
        expect(res.body.scoped).toBe(false);
        expect(relationReads).not.toHaveBeenCalled(); // never queried the relation
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/options?source_model=hr.expense&field=x_studio_ispc');
        expect(res.status).toBe(401);
    });
});
