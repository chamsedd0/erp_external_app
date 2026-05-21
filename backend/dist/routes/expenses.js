"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
const schemaCache_1 = require("../lib/schemaCache");
const parseError_1 = require("../odoo/parseError");
const authContext_1 = require("../lib/authContext");
const odooCompatibility_1 = require("../lib/odooCompatibility");
const router = (0, express_1.Router)();
// Shared attachment schema
const attachmentSchema = zod_1.z.object({
    name: zod_1.z.string(),
    data: zod_1.z.string(), // base64
    mimetype: zod_1.z.string(), // e.g. 'image/jpeg'
});
// Validation Schema for Expense
const createExpenseSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    product_id: zod_1.z.number(),
    name: zod_1.z.string(), // Description
    unit_amount: zod_1.z.number(), // Cost per unit
    quantity: zod_1.z.number().default(1),
    date: zod_1.z.string(), // YYYY-MM-DD
    payment_mode: zod_1.z.enum(['own_account', 'company_account']).default('own_account'),
    tax_ids: zod_1.z.array(zod_1.z.number()).optional(),
    attachments: zod_1.z.array(attachmentSchema).max(3).optional(), // Up to 3 receipt images
});
// Fields to fetch for expenses — price_unit may not exist on Odoo 17+
const EXPENSE_READ_FIELDS_FULL = ['id', 'name', 'product_id', 'price_unit', 'quantity', 'total_amount', 'date', 'state', 'create_date'];
const EXPENSE_READ_FIELDS_FALLBACK = ['id', 'name', 'product_id', 'quantity', 'total_amount', 'date', 'state', 'create_date'];
const INCOMPATIBLE_EXPENSE_PRODUCT = 'The selected product belongs to a different company than your employee profile. Choose a product from your own company.';
async function fetchExpenses(uid, client, domain, customFieldNames = []) {
    const fullFields = [...EXPENSE_READ_FIELDS_FULL, ...customFieldNames];
    const fallbackFields = [...EXPENSE_READ_FIELDS_FALLBACK, ...customFieldNames];
    try {
        return await client.searchRead(uid, 'hr.expense', domain, fullFields);
    }
    catch {
        return await client.searchRead(uid, 'hr.expense', domain, fallbackFields);
    }
}
// GET / - Fetch user's expenses
router.get('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const parsedEmployeeId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.expense');
        const customFieldNames = Object.keys(customFields);
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', parsedEmployeeId]], customFieldNames);
        res.json({ expenses, custom_fields: customFields });
    }
    catch (error) {
        console.error('Fetch Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /pending?employee_id=X - Fetch pending expenses (draft or reported) for an employee
router.get('/pending', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const id = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
        const uid = await client.authenticate();
        const customFields = await (0, schemaCache_1.getCustomFields)(tenantId, client, uid, 'hr.expense');
        const customFieldNames = Object.keys(customFields);
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', id], ['state', 'in', ['draft', 'reported']]], customFieldNames);
        res.json({ expenses, custom_fields: customFields });
    }
    catch (error) {
        console.error('Fetch Pending Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /taxes - Fetch applicable taxes for expenses
router.get('/taxes', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        const taxes = await client.searchRead(uid, 'account.tax', [['active', '=', true], ['type_tax_use', 'in', ['purchase', 'all']]], ['id', 'name', 'amount', 'amount_type']);
        res.json({ taxes: Array.isArray(taxes) ? taxes : [] });
    }
    catch (error) {
        console.error('Fetch Expense Taxes Error:', error);
        res.json({ taxes: [], error: error.message });
    }
});
// GET /products - Fetch Expense Products
router.get('/products', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const uid = await client.authenticate();
        let products = [];
        try {
            const result = await client.searchRead(uid, 'product.product', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price', 'company_id'], true);
            products = Array.isArray(result) ? result : [];
        }
        catch (e) {
            console.warn('product.product can_be_expensed query failed, trying product.product fallback without company:', e);
            try {
                const result = await client.searchRead(uid, 'product.product', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price']);
                products = Array.isArray(result) ? result : [];
            }
            catch (fallbackError) {
                console.warn('product.product fallback also failed, trying product.template:', fallbackError);
            }
        }
        if (products.length === 0) {
            try {
                const templates = await client.searchRead(uid, 'product.template', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price', 'product_variant_ids', 'company_id'], true);
                if (Array.isArray(templates)) {
                    products = templates
                        .filter((t) => Array.isArray(t.product_variant_ids) && t.product_variant_ids.length > 0)
                        .map((t) => ({
                        id: t.product_variant_ids[0],
                        name: t.name,
                        standard_price: t.standard_price,
                        company_id: t.company_id,
                    }));
                }
            }
            catch (e) {
                console.warn('product.template fallback with company failed:', e);
                try {
                    const templates = await client.searchRead(uid, 'product.template', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price', 'product_variant_ids']);
                    if (Array.isArray(templates)) {
                        products = templates
                            .filter((t) => Array.isArray(t.product_variant_ids) && t.product_variant_ids.length > 0)
                            .map((t) => ({
                            id: t.product_variant_ids[0],
                            name: t.name,
                            standard_price: t.standard_price,
                        }));
                    }
                }
                catch (fallbackError) {
                    console.warn('product.template fallback also failed:', fallbackError);
                }
            }
        }
        let employeeCompanyId = null;
        try {
            const employeeId = (0, authContext_1.getAuthenticatedEmployeeId)(req, req.query.employee_id);
            employeeCompanyId = await (0, odooCompatibility_1.getEmployeeCompanyId)(client, uid, employeeId);
        }
        catch (e) {
            console.warn('[expenses] employee company lookup failed; returning unfiltered products:', e);
        }
        const enriched = (0, odooCompatibility_1.withCompanyRequestability)(products, employeeCompanyId, INCOMPATIBLE_EXPENSE_PRODUCT);
        res.json({ products: (0, odooCompatibility_1.requestableRecords)(enriched) });
    }
    catch (error) {
        console.error('Fetch Expense Products Error:', error);
        res.json({ products: [], error: error.message });
    }
});
// POST / - Create Expense
router.post('/', async (req, res) => {
    try {
        const tenantId = req.jwtPayload?.tenantId;
        const tenantConfig = await tenantStore_1.tenantStore.getTenant(tenantId);
        if (!tenantConfig)
            return res.status(401).json({ error: 'Unknown tenant' });
        const client = (0, client_1.getOdooClient)(tenantId, tenantConfig);
        const body = { ...createExpenseSchema.parse(req.body), employee_id: (0, authContext_1.getAuthenticatedEmployeeId)(req, req.body?.employee_id) };
        const uid = await client.authenticate();
        const employees = await client.searchRead(uid, 'hr.employee', [['id', '=', body.employee_id]], ['company_id']);
        if (!employees || employees.length === 0) {
            return res.status(400).json({ error: 'Employee not found' });
        }
        const employee = employees[0];
        const companyId = employee.company_id[0];
        const companies = await client.searchRead(uid, 'res.company', [['id', '=', companyId]], ['currency_id']);
        const currencyId = companies && companies[0] && companies[0].currency_id
            ? companies[0].currency_id[0]
            : 1;
        const selectedProducts = await client.searchRead(uid, 'product.product', [['id', '=', body.product_id]], ['id', 'company_id'], true).catch(() => []);
        if (Array.isArray(selectedProducts) &&
            selectedProducts.length > 0 &&
            !(0, odooCompatibility_1.companyCompatible)(selectedProducts[0].company_id, companyId)) {
            return res.status(422).json({ error: INCOMPATIBLE_EXPENSE_PRODUCT });
        }
        // Detect Odoo version to select the correct amount field.
        // v17+ replaced price_unit (writable) with total_amount as the primary input field.
        const odooVersion = await client.getVersion().catch(() => 16);
        const useNewAmountField = odooVersion >= 17;
        const baseExpenseData = {
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
        // Pre-validate payload against live Odoo schema (selection values + required fields)
        const validation = await (0, schemaCache_1.validatePayload)(tenantId, client, uid, 'hr.expense', baseExpenseData);
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
        let newExpenseId;
        try {
            newExpenseId = await client.createRecord(uid, 'hr.expense', primaryPayload);
        }
        catch (err1) {
            const msg1 = String(err1?.faultString || err1?.message || '').toLowerCase();
            // total_amount_currency rejected — strip it and retry same amount field
            if (msg1.includes('total_amount_currency') || (msg1.includes('invalid field') && msg1.includes('total_amount_currency'))) {
                console.warn('[expenses] total_amount_currency rejected, retrying without it');
                const withoutCurrency = useNewAmountField ? withTotalAmount : withPriceUnit;
                try {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', withoutCurrency);
                }
                catch (err2) {
                    const msg2 = String(err2?.faultString || err2?.message || '').toLowerCase();
                    // price_unit rejected on v17+ — switch to total_amount
                    if (msg2.includes('price_unit')) {
                        console.warn('[expenses] price_unit rejected (Odoo 17+), switching to total_amount');
                        newExpenseId = await client.createRecord(uid, 'hr.expense', withTotalAmount);
                    }
                    else {
                        throw err2;
                    }
                }
            }
            else if (msg1.includes('price_unit')) {
                // price_unit rejected directly — switch to total_amount
                console.warn('[expenses] price_unit rejected (Odoo 17+), switching to total_amount');
                try {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', {
                        ...withTotalAmount,
                        total_amount_currency: body.unit_amount * body.quantity,
                    });
                }
                catch {
                    newExpenseId = await client.createRecord(uid, 'hr.expense', withTotalAmount);
                }
            }
            else if (msg1.includes('incompatible companies') || msg1.includes('company')) {
                return res.status(422).json({ error: INCOMPATIBLE_EXPENSE_PRODUCT });
            }
            else {
                throw err1;
            }
        }
        if (body.attachments && body.attachments.length > 0) {
            try {
                await client.uploadAttachments(uid, body.attachments, 'hr.expense', newExpenseId);
            }
            catch (attachError) {
                console.error('Attachment upload error:', attachError);
            }
        }
        res.json({ status: 'success', id: newExpenseId, state: 'draft', message: 'Expense created in draft state' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        return (0, parseError_1.sendOdooError)(res, error, 'Create Expense');
    }
});
exports.expensesRouter = router;
