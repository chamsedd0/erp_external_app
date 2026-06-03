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

// ─── GET /expenses ─────────────────────────────────────────────────────────────

describe('GET /expenses', () => {
    it('returns expenses list for valid JWT', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'Hotel', product_id: [5, 'Travel'], price_unit: 200, state: 'draft' },
        ]);

        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('expenses');
        expect(res.body.expenses).toHaveLength(1);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/expenses?employee_id=42');
        expect(res.status).toBe(401);
    });

    it('returns 401 when tenant not found', async () => {
        mockTenantStore.getTenant.mockResolvedValue(null);
        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(401);
    });

    it('derives employee_id from JWT when query parameter is missing', async () => {
        const res = await request(app)
            .get('/expenses')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
    });

    it('returns 500 when Odoo searchRead throws', async () => {
        mockClient.searchRead.mockRejectedValue(new Error('Odoo down'));
        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());
        expect(res.status).toBe(500);
    });
});

// ─── GET /expenses/pending ─────────────────────────────────────────────────────

describe('GET /expenses/pending', () => {
    it('returns pending expenses (draft or reported)', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 3, name: 'Taxi', state: 'draft' },
            { id: 4, name: 'Lunch', state: 'reported' },
        ]);

        const res = await request(app)
            .get('/expenses/pending?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.expenses).toHaveLength(2);
    });

    it('derives employee_id from JWT when query parameter is missing', async () => {
        const res = await request(app)
            .get('/expenses/pending')
            .set('Authorization', authHeader());
        expect(res.status).toBe(200);
    });
});

// ─── GET /expenses/products ────────────────────────────────────────────────────

describe('GET /expenses/products', () => {
    it('returns products from product.product when available', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 10, name: 'Accommodation', standard_price: 0 },
            { id: 11, name: 'Meals', standard_price: 0 },
        ]);

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.products).toHaveLength(2);
        expect(res.body.products[0].name).toBe('Accommodation');
    });

    it('falls back to product.template when product.product returns empty', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([]) // product.product returns nothing
            .mockResolvedValueOnce([   // product.template fallback
                { id: 20, name: 'Transport', standard_price: 0, product_variant_ids: [55] },
                { id: 21, name: 'Hotel', standard_price: 0, product_variant_ids: [56] },
            ]);

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.products).toHaveLength(2);
        // Mapped to variant id
        expect(res.body.products[0].id).toBe(55);
    });

    it('falls back to product.template when product.product throws', async () => {
        mockClient.searchRead
            .mockRejectedValueOnce(new Error('model not found'))
            .mockResolvedValueOnce([
                { id: 30, name: 'Parking', standard_price: 0, product_variant_ids: [60] },
            ]);

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.products).toHaveLength(1);
    });

    it('returns empty products when both sources fail', async () => {
        mockClient.searchRead
            .mockRejectedValueOnce(new Error('product.product error'))
            .mockRejectedValueOnce(new Error('product.template error'));

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.products).toEqual([]);
    });

    it('excludes template entries with no variants', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([]) // product.product empty
            .mockResolvedValueOnce([
                { id: 20, name: 'With Variants', standard_price: 0, product_variant_ids: [55] },
                { id: 21, name: 'No Variants', standard_price: 0, product_variant_ids: [] },
            ]);

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.body.products).toHaveLength(1);
        expect(res.body.products[0].name).toBe('With Variants');
    });

    it('excludes products from a different employee company', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([
                { id: 10, name: 'Same Company', standard_price: 0, company_id: [1, 'My Company'] },
                { id: 11, name: 'Global Product', standard_price: 0, company_id: false },
                { id: 12, name: 'Other Company', standard_price: 0, company_id: [2, 'Other'] },
            ])
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }]);

        const res = await request(app)
            .get('/expenses/products')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.products.map((p: any) => p.name)).toEqual(['Same Company', 'Global Product']);
    });
});

// ─── POST /expenses ────────────────────────────────────────────────────────────

describe('POST /expenses', () => {
    const VALID_BODY = {
        employee_id: 42,
        product_id: 10,
        name: 'Hotel in Paris',
        unit_amount: 250,
        date: '2025-06-15',
    };

    function setupValidCreate(expenseId = 77) {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }]) // hr.employee
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }]);        // res.company
        mockClient.createRecord.mockResolvedValueOnce(expenseId);
    }

    it('creates expense and returns 200 with id', async () => {
        setupValidCreate(77);

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(77);
        expect(res.body.status).toBe('success');
    });

    it('returns 400 when product_id is missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, product_id: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, name: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when unit_amount is missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, unit_amount: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when date is missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, date: undefined });
        expect(res.status).toBe(400);
    });

    it('returns 400 when employee_id is missing', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, employee_id: undefined });
        expect(res.status).toBe(400);
    });

    it('retries without total_amount_currency when first create throws "Invalid field"', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }]);
        mockClient.createRecord
            .mockRejectedValueOnce({ faultString: 'Invalid field total_amount_currency on model hr.expense' })
            .mockResolvedValueOnce(88);

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(88);
        // Second call should NOT include total_amount_currency
        const secondCallData = mockClient.createRecord.mock.calls[1][2];
        expect(secondCallData).not.toHaveProperty('total_amount_currency');
    });

    it('calls uploadAttachments when attachments provided', async () => {
        setupValidCreate(99);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [{ name: 'receipt.jpg', data: 'base64data==', mimetype: 'image/jpeg' }],
            });

        expect(mockClient.uploadAttachments).toHaveBeenCalledWith(
            1, expect.any(Array), 'hr.expense', 99, expect.any(Object)
        );
    });

    it('returns 500 when Odoo createRecord throws unrecognized error', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }]);
        mockClient.createRecord.mockRejectedValue(new Error('Unexpected Odoo RPC error'));

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(500);
    });

    it('returns 400 when employee is not found in Odoo', async () => {
        mockClient.searchRead.mockResolvedValueOnce([]); // employee not found

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/employee not found/i);
    });

    it('returns 422 before create when selected product belongs to another company', async () => {
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }])
            .mockResolvedValueOnce([{ id: 10, company_id: [2, 'Other Company'] }]);

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY);

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/different company/i);
        expect(mockClient.createRecord).not.toHaveBeenCalled();
    });

    it('passes payment_mode: company_account when provided', async () => {
        setupValidCreate(77);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, payment_mode: 'company_account' });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.payment_mode).toBe('company_account');
    });

    it('uses payment_mode: own_account by default', async () => {
        setupValidCreate(77);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(VALID_BODY); // no payment_mode

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.payment_mode).toBe('own_account');
    });

    it('sends tax_ids as Many2many command [[6,0,[...]]] when provided', async () => {
        setupValidCreate(78);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, tax_ids: [5, 6] });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs.tax_ids).toEqual([[6, 0, [5, 6]]]);
    });

    it('omits tax_ids key when array is empty', async () => {
        setupValidCreate(79);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, tax_ids: [] });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).not.toHaveProperty('tax_ids');
    });

    it('returns 400 when more than 3 attachments are provided', async () => {
        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({
                ...VALID_BODY,
                attachments: [
                    { name: 'a.jpg', data: 'b64', mimetype: 'image/jpeg' },
                    { name: 'b.jpg', data: 'b64', mimetype: 'image/jpeg' },
                    { name: 'c.jpg', data: 'b64', mimetype: 'image/jpeg' },
                    { name: 'd.jpg', data: 'b64', mimetype: 'image/jpeg' },
                ],
            });
        expect(res.status).toBe(400);
    });

    it('uses total_amount instead of price_unit on Odoo 17+', async () => {
        mockClient.getVersion.mockResolvedValue(17);
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }]);
        mockClient.createRecord.mockResolvedValueOnce(80);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, unit_amount: 100 });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).toHaveProperty('total_amount');
        expect(createArgs).not.toHaveProperty('price_unit');
    });

    it('uses price_unit on Odoo 16', async () => {
        mockClient.getVersion.mockResolvedValue(16);
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'My Company'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [3, 'USD'] }]);
        mockClient.createRecord.mockResolvedValueOnce(81);

        await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send({ ...VALID_BODY, unit_amount: 100 });

        const createArgs = mockClient.createRecord.mock.calls[0][2];
        expect(createArgs).toHaveProperty('price_unit');
    });
});

// ─── GET /expenses/taxes ───────────────────────────────────────────────────────

describe('GET /expenses/taxes', () => {
    it('returns tax list filtered to purchase/all usage', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 1, name: 'VAT 20%', amount: 20, amount_type: 'percent' },
            { id: 2, name: 'Fixed Fee', amount: 5, amount_type: 'fixed' },
        ]);

        const res = await request(app)
            .get('/expenses/taxes')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.taxes).toHaveLength(2);
        expect(res.body.taxes[0].name).toBe('VAT 20%');
    });

    it('returns empty taxes array when searchRead throws (silent fail)', async () => {
        mockClient.searchRead.mockRejectedValueOnce(new Error('account.tax not found'));

        const res = await request(app)
            .get('/expenses/taxes')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.taxes).toEqual([]);
    });

    it('returns 401 without JWT', async () => {
        const res = await request(app).get('/expenses/taxes');
        expect(res.status).toBe(401);
    });
});

// ─── Resilience: unknown/custom Odoo fields ────────────────────────────────────

describe('GET /expenses — resilience: unknown Odoo fields', () => {
    it('succeeds when Odoo returns extra unknown custom fields in the response', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            {
                id: 1,
                name: 'Conference ticket',
                product_id: [5, 'Travel'],
                price_unit: 200,
                state: 'draft',
                custom_approval_field: 'level_2',     // unknown custom field
                x_studio_internal_code: 'CONF-2026',  // studio custom field
                extra_meta: { some: 'object' },
            },
        ]);

        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.expenses).toHaveLength(1);
        expect(res.body.expenses[0].name).toBe('Conference ticket');
    });

    it('handles product_id as null (not false) without crashing', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 2, name: 'Unknown product', product_id: null, price_unit: 50, state: 'draft' },
        ]);

        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.expenses[0].product_name).toBeFalsy();
    });

    it('handles product_id as empty array without crashing', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 3, name: 'Edge case', product_id: [], price_unit: 100, state: 'draft' },
        ]);

        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.expenses).toHaveLength(1);
    });

    it('handles product_id as [id] tuple missing the name part', async () => {
        mockClient.searchRead.mockResolvedValueOnce([
            { id: 4, name: 'Single tuple', product_id: [7], price_unit: 75, state: 'draft' },
        ]);

        const res = await request(app)
            .get('/expenses?employee_id=42')
            .set('Authorization', authHeader());

        expect(res.status).toBe(200);
        expect(res.body.expenses).toHaveLength(1);
    });
});

// ─── Resilience: Odoo version detection edge cases ─────────────────────────────

describe('POST /expenses — resilience: Odoo version detection edge cases', () => {
    const BASE_BODY = {
        employee_id: 42,
        name: 'Business flight',
        product_id: 5,
        unit_amount: 800,
        date: '2026-05-01',
        payment_mode: 'own_account',
    };

    it('uses total_amount when getVersion() returns 17', async () => {
        mockClient.getVersion.mockResolvedValueOnce(17);
        // POST /expenses calls searchRead twice: employee lookup, then company lookup
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'Test Corp'] }])  // hr.employee
            .mockResolvedValueOnce([{ id: 1, currency_id: [1, 'USD'] }]);        // res.company
        mockClient.createRecord.mockResolvedValueOnce(55);

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(BASE_BODY);

        expect(res.status).toBe(200);
        const callArgs = mockClient.createRecord.mock.calls[0];
        expect(callArgs[2]).toHaveProperty('total_amount');
    });

    it('uses price_unit when getVersion() returns 16', async () => {
        mockClient.getVersion.mockResolvedValueOnce(16);
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'Test Corp'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [1, 'USD'] }]);
        mockClient.createRecord.mockResolvedValueOnce(56);

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(BASE_BODY);

        expect(res.status).toBe(200);
        const callArgs = mockClient.createRecord.mock.calls[0];
        expect(callArgs[2]).toHaveProperty('price_unit');
    });

    it('falls back to total_amount when price_unit is rejected with "Invalid field"', async () => {
        mockClient.getVersion.mockResolvedValueOnce(16); // v16 path → primary uses price_unit
        mockClient.searchRead
            .mockResolvedValueOnce([{ id: 42, company_id: [1, 'Test Corp'] }])
            .mockResolvedValueOnce([{ id: 1, currency_id: [1, 'USD'] }]);
        mockClient.createRecord
            .mockRejectedValueOnce(new Error('Invalid field price_unit'))  // first attempt fails
            .mockResolvedValueOnce(57);                                     // retry with total_amount succeeds

        const res = await request(app)
            .post('/expenses')
            .set('Authorization', authHeader())
            .send(BASE_BODY);

        expect(res.status).toBe(200);
        // second call should use total_amount
        const secondCallArgs = mockClient.createRecord.mock.calls[1];
        expect(secondCallArgs[2]).toHaveProperty('total_amount');
    });
});
