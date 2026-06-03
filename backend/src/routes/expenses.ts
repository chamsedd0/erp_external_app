import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';
import { getCustomFieldReport, getCustomFields, validatePayload, validateRequiredCustomFields } from '../lib/schemaCache';
import { sendOdooError } from '../odoo/parseError';
import { buildOdooContext, getAuthenticatedEmployeeId, getActiveCompanyId, getLang, getOdooContext } from '../lib/authContext';
import { companyCompatible, companyContext, getEmployeeCompanyId, requestableRecords, withCompanyRequestability } from '../lib/odooCompatibility';
import { attachmentsSchema } from '../lib/attachments';

const router = Router();

// Validation Schema for Expense
const createExpenseSchema = z.object({
    employee_id: z.number(),
    product_id: z.number(),
    name: z.string(), // Description
    unit_amount: z.number(), // Cost per unit
    quantity: z.number().default(1),
    date: z.string(), // YYYY-MM-DD
    payment_mode: z.enum(['own_account', 'company_account']).default('own_account'),
    tax_ids: z.array(z.number()).optional(),
    analytic_account_id: z.number().optional(),
    custom_values: z.record(z.string(), z.any()).optional(), // tenant-specific x_ custom fields
    attachments: attachmentsSchema, // Up to 3 receipt images
});

// Fields to fetch for expenses — price_unit may not exist on Odoo 17+
const EXPENSE_READ_FIELDS_FULL = ['id', 'name', 'product_id', 'price_unit', 'quantity', 'total_amount', 'date', 'state', 'create_date'];
const EXPENSE_READ_FIELDS_FALLBACK = ['id', 'name', 'product_id', 'quantity', 'total_amount', 'date', 'state', 'create_date'];
const INCOMPATIBLE_EXPENSE_PRODUCT = 'The selected product belongs to a different company than your employee profile. Choose a product from your own company.';

async function fetchExpenses(uid: number, client: any, domain: any[], customFieldNames: string[] = []): Promise<any[]> {
    const fullFields = [...EXPENSE_READ_FIELDS_FULL, ...customFieldNames];
    const fallbackFields = [...EXPENSE_READ_FIELDS_FALLBACK, ...customFieldNames];
    try {
        return await client.searchRead(uid, 'hr.expense', domain, fullFields);
    } catch {
        return await client.searchRead(uid, 'hr.expense', domain, fallbackFields);
    }
}

// GET / - Fetch user's expenses
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const parsedEmployeeId = getAuthenticatedEmployeeId(req, req.query.employee_id);

        const uid = await client.authenticate();
        const customFields = await getCustomFields(tenantId, client, uid, 'hr.expense');
        const customFieldNames = Object.keys(customFields);
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', parsedEmployeeId]], customFieldNames);
        res.json({ expenses, custom_fields: customFields });
    } catch (error: any) {
        console.error('Fetch Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /pending?employee_id=X - Fetch pending expenses (draft or reported) for an employee
router.get('/pending', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const id = getAuthenticatedEmployeeId(req, req.query.employee_id);

        const uid = await client.authenticate();
        const customFields = await getCustomFields(tenantId, client, uid, 'hr.expense');
        const customFieldNames = Object.keys(customFields);
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', id], ['state', 'in', ['draft', 'reported']]], customFieldNames);
        res.json({ expenses, custom_fields: customFields });
    } catch (error: any) {
        console.error('Fetch Pending Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /taxes - Fetch applicable taxes for expenses
router.get('/taxes', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();
        const taxes: any = await client.searchRead(
            uid,
            'account.tax',
            [['active', '=', true], ['type_tax_use', 'in', ['purchase', 'all']]],
            ['id', 'name', 'amount', 'amount_type'],
            { context: getOdooContext(req) }
        );
        res.json({ taxes: Array.isArray(taxes) ? taxes : [] });
    } catch (error: any) {
        console.error('Fetch Expense Taxes Error:', error);
        res.json({ taxes: [], error: error.message });
    }
});

// GET /products - Fetch Expense Products
router.get('/products', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const uid = await client.authenticate();
        const ctx = getOdooContext(req);
        let products: any[] = [];

        try {
            const result: any = await client.searchRead(
                uid,
                'product.product',
                [['can_be_expensed', '=', true]],
                ['id', 'name', 'standard_price', 'company_id'],
                    { silent: true, context: ctx }
            );
            products = Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('product.product can_be_expensed query failed, trying product.product fallback without company:', e);
            try {
                const result: any = await client.searchRead(
                    uid,
                    'product.product',
                    [['can_be_expensed', '=', true]],
                    ['id', 'name', 'standard_price']
                );
                products = Array.isArray(result) ? result : [];
            } catch (fallbackError) {
                console.warn('product.product fallback also failed, trying product.template:', fallbackError);
            }
        }

        if (products.length === 0) {
            try {
                const templates: any = await client.searchRead(
                    uid,
                    'product.template',
                    [['can_be_expensed', '=', true]],
                    ['id', 'name', 'standard_price', 'product_variant_ids', 'company_id'],
                    true
                );
                if (Array.isArray(templates)) {
                    products = templates
                        .filter((t: any) =>
                            Array.isArray(t.product_variant_ids) && t.product_variant_ids.length > 0
                        )
                        .map((t: any) => ({
                            id: t.product_variant_ids[0],
                            name: t.name,
                            standard_price: t.standard_price,
                            company_id: t.company_id,
                        }));
                }
            } catch (e) {
                console.warn('product.template fallback with company failed:', e);
                try {
                    const templates: any = await client.searchRead(
                        uid,
                        'product.template',
                        [['can_be_expensed', '=', true]],
                        ['id', 'name', 'standard_price', 'product_variant_ids']
                    );
                    if (Array.isArray(templates)) {
                        products = templates
                            .filter((t: any) =>
                                Array.isArray(t.product_variant_ids) && t.product_variant_ids.length > 0
                            )
                            .map((t: any) => ({
                                id: t.product_variant_ids[0],
                                name: t.name,
                                standard_price: t.standard_price,
                            }));
                    }
                } catch (fallbackError) {
                    console.warn('product.template fallback also failed:', fallbackError);
                }
            }
        }

        const activeCompanyId = ctx.company_id;
        let employeeCompanyId: number | null = null;
        try {
            const employeeId = getAuthenticatedEmployeeId(req, req.query.employee_id);
            employeeCompanyId = await getEmployeeCompanyId(client, uid, employeeId);
        } catch (e) {
            console.warn('[expenses] employee company lookup failed; returning unfiltered products:', e);
        }

        const enriched = withCompanyRequestability(products, activeCompanyId ?? employeeCompanyId, INCOMPATIBLE_EXPENSE_PRODUCT);
        res.json({ products: requestableRecords(enriched) });
    } catch (error: any) {
        console.error('Fetch Expense Products Error:', error);
        res.json({ products: [], error: error.message });
    }
});

// GET /analytic-accounts - Analytic accounts for the active company
router.get('/analytic-accounts', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();
        const accounts: any = await client
            .searchRead(uid, 'account.analytic.account', [], ['id', 'name'], {
                silent: true,
                context: getOdooContext(req),
                limit: 500,
            })
            .catch(() => []);
        res.json({ accounts: Array.isArray(accounts) ? accounts : [] });
    } catch (error: any) {
        console.error('Fetch Analytic Accounts Error:', error);
        res.json({ accounts: [], error: error.message });
    }
});

// GET /form-schema - Tenant custom (x_) fields for the expense create form
router.get('/form-schema', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);
        const uid = await client.authenticate();
        res.json(await getCustomFieldReport(tenantId, client, uid, 'hr.expense'));
    } catch (error: any) {
        console.error('Fetch Expense Form Schema Error:', error);
        res.json({ custom_fields: {}, schema_available: false, unsupported_fields: {}, unsupported_required_fields: {}, schema_cached_at: null });
    }
});

// POST / - Create Expense
router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = { ...createExpenseSchema.parse(req.body), employee_id: getAuthenticatedEmployeeId(req, req.body?.employee_id) };
        const uid = await client.authenticate();

        const employees: any = await client.searchRead(
            uid,
            'hr.employee',
            [['id', '=', body.employee_id]],
            ['company_id']
        );

        if (!employees || employees.length === 0) {
            return res.status(400).json({ error: 'Employee not found' });
        }

        const employee = employees[0];
        const selectedCompanyId = getActiveCompanyId(req);
        const employeeCompanyId = Array.isArray(employee.company_id) ? employee.company_id[0] : null;
        if (selectedCompanyId && employeeCompanyId && selectedCompanyId !== employeeCompanyId) {
            return res.status(422).json({ error: 'Selected company is not available for this employee.' });
        }
        const lang = getLang(req);
        const ctx: Record<string, any> = {
            ...companyContext(selectedCompanyId ?? employeeCompanyId),
            ...(lang ? { lang } : {}),
        };
        // Prefer the operating company chosen in the app; fall back to the employee's company.
        const activeCompanyId = getActiveCompanyId(req);
        // Never trust the X-Company-Id header blindly — it must be a company the
        // integration user can actually operate in.
        if (activeCompanyId) {
            const allowedCompanies = [activeCompanyId];
            if (allowedCompanies.length > 0 && !allowedCompanies.includes(activeCompanyId)) {
                return res.status(422).json({ error: 'Selected company is not available.' });
            }
        }
        const companyId = ctx.company_id ?? employee.company_id[0];

        const companies: any = await client.searchRead(
            uid,
            'res.company',
            [['id', '=', companyId]],
            ['currency_id']
        );

        const currencyId = companies && companies[0] && companies[0].currency_id
            ? companies[0].currency_id[0]
            : 1;

        const selectedProducts: any = await client.searchRead(
            uid,
            'product.product',
            [['id', '=', body.product_id]],
            ['id', 'company_id'],
            true
        ).catch(() => []);
        if (
            Array.isArray(selectedProducts) &&
            selectedProducts.length > 0 &&
            !companyCompatible(selectedProducts[0].company_id, companyId)
        ) {
            return res.status(422).json({ error: INCOMPATIBLE_EXPENSE_PRODUCT });
        }

        // Detect Odoo version to select the correct amount field.
        // v17+ replaced price_unit (writable) with total_amount as the primary input field.
        const odooVersion = await client.getVersion().catch(() => 16);
        const useNewAmountField = odooVersion >= 17;

        const baseExpenseData: Record<string, any> = {
            employee_id: body.employee_id,
            product_id: body.product_id,
            name: body.name,
            quantity: body.quantity,
            date: body.date,
            company_id: companyId,
            currency_id: currencyId,
            payment_mode: body.payment_mode,
        };

        if (body.tax_ids && body.tax_ids.length > 0) {
            baseExpenseData.tax_ids = [[6, 0, body.tax_ids]];
        }

        // Analytic account → single-account distribution (Odoo 16+ uses the JSON
        // analytic_distribution field; older versions used a scalar analytic_account_id).
        if (body.analytic_account_id) {
            if (odooVersion >= 16) {
                baseExpenseData.analytic_distribution = { [String(body.analytic_account_id)]: 100 };
            } else {
                baseExpenseData.analytic_account_id = body.analytic_account_id;
            }
        }

        // Tenant-specific custom (x_) fields, validated below against the live schema.
        if (body.custom_values && typeof body.custom_values === 'object') {
            Object.assign(baseExpenseData, body.custom_values);
        }

        // Enforce required custom fields up-front so the user gets a clear message
        // instead of a downstream Odoo write error.
        const expenseCustomFields = await getCustomFields(tenantId, client, uid, 'hr.expense');
        const missingCustom = validateRequiredCustomFields(expenseCustomFields, body.custom_values);
        if (missingCustom.length > 0) {
            return res.status(400).json({ error: 'Validation failed', missing_required: missingCustom });
        }

        // Pre-validate payload against live Odoo schema (selection values + required fields)
        const validation = await validatePayload(tenantId, client, uid, 'hr.expense', baseExpenseData);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                missing_required: validation.missing,
                invalid_values: validation.invalid,
            });
        }

        // Build the amount field based on version, with layered retry fallback
        const withPriceUnit = { ...baseExpenseData, price_unit: body.unit_amount };
        const withTotalAmount = { ...baseExpenseData, total_amount: body.unit_amount * body.quantity };

        const primaryPayload = useNewAmountField
            ? { ...withTotalAmount, total_amount_currency: body.unit_amount * body.quantity }
            : { ...withPriceUnit, total_amount_currency: body.unit_amount };

        let newExpenseId: any;
        try {
            newExpenseId = await client.createRecord(uid, 'hr.expense', primaryPayload, ctx);
        } catch (err1: any) {
            const msg1 = String(err1?.faultString || err1?.message || '').toLowerCase();

            // total_amount_currency rejected — strip it and retry same amount field
            if (msg1.includes('total_amount_currency') || (msg1.includes('invalid field') && msg1.includes('total_amount_currency'))) {
                console.warn('[expenses] total_amount_currency rejected, retrying without it');
                const withoutCurrency = useNewAmountField ? withTotalAmount : withPriceUnit;
                try {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', withoutCurrency, ctx);
                } catch (err2: any) {
                    const msg2 = String(err2?.faultString || err2?.message || '').toLowerCase();
                    // price_unit rejected on v17+ — switch to total_amount
                    if (msg2.includes('price_unit')) {
                        console.warn('[expenses] price_unit rejected (Odoo 17+), switching to total_amount');
                        newExpenseId = await client.createRecord(uid, 'hr.expense', withTotalAmount, ctx);
                    } else {
                        throw err2;
                    }
                }
            } else if (msg1.includes('price_unit')) {
                // price_unit rejected directly — switch to total_amount
                console.warn('[expenses] price_unit rejected (Odoo 17+), switching to total_amount');
                try {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', {
                        ...withTotalAmount,
                        total_amount_currency: body.unit_amount * body.quantity,
                    }, ctx);
                } catch {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', withTotalAmount, ctx);
                }
            } else if (msg1.includes('incompatible companies') || msg1.includes('company')) {
                return res.status(422).json({ error: INCOMPATIBLE_EXPENSE_PRODUCT });
            } else {
                throw err1;
            }
        }

        let failedAttachments: string[] = [];
        if (body.attachments && body.attachments.length > 0) {
            try {
                const result = await client.uploadAttachments(uid, body.attachments, 'hr.expense', newExpenseId as number, ctx);
                failedAttachments = result?.failed ?? [];
            } catch (attachError: any) {
                console.error('Attachment upload error:', attachError);
                failedAttachments = body.attachments.map(a => a.name);
            }
        }

        res.json({
            status: 'success',
            id: newExpenseId,
            state: 'draft',
            message: 'Expense created in draft state',
            ...(failedAttachments.length > 0
                ? { partial_success: true, failed_attachments: failedAttachments }
                : {}),
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        return sendOdooError(res, error, 'Create Expense');
    }
});

export const expensesRouter = router;
