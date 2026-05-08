"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const tenantStore_1 = require("../lib/tenantStore");
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
async function fetchExpenses(uid, client, domain) {
    try {
        return await client.searchRead(uid, 'hr.expense', domain, EXPENSE_READ_FIELDS_FULL);
    }
    catch {
        return await client.searchRead(uid, 'hr.expense', domain, EXPENSE_READ_FIELDS_FALLBACK);
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
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const parsedEmployeeId = parseInt(employeeId);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }
        const uid = await client.authenticate();
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', parsedEmployeeId]]);
        res.json({ expenses });
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
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const id = parseInt(employeeId);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }
        const uid = await client.authenticate();
        const expenses = await fetchExpenses(uid, client, [['employee_id', '=', id], ['state', 'in', ['draft', 'reported']]]);
        res.json({ expenses });
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
            const result = await client.searchRead(uid, 'product.product', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price']);
            products = Array.isArray(result) ? result : [];
        }
        catch (e) {
            console.warn('product.product can_be_expensed query failed, trying product.template fallback:', e);
        }
        if (products.length === 0) {
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
            catch (e) {
                console.warn('product.template fallback also failed:', e);
            }
        }
        res.json({ products });
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
        const body = createExpenseSchema.parse(req.body);
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
        console.error('Create Expense Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.expensesRouter = router;
