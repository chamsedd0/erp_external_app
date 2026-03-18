import { Router } from 'express';
import { z } from 'zod';
import { getOdooClient } from '../odoo/client';
import { tenantStore } from '../lib/tenantStore';

const router = Router();

// Shared attachment schema
const attachmentSchema = z.object({
    name: z.string(),
    data: z.string(),     // base64
    mimetype: z.string(), // e.g. 'image/jpeg'
});

// Validation Schema for Expense
const createExpenseSchema = z.object({
    employee_id: z.number(),
    product_id: z.number(),
    name: z.string(), // Description
    unit_amount: z.number(), // Cost per unit (mapped to price_unit & total_amount_currency)
    quantity: z.number().default(1),
    date: z.string(), // YYYY-MM-DD
    attachments: z.array(attachmentSchema).max(3).optional(), // Up to 3 receipt images
});

// GET / - Fetch user's expenses
router.get('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const parsedEmployeeId = parseInt(employeeId as string);
        if (isNaN(parsedEmployeeId)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        const uid = await client.authenticate();
        const expenses: any = await client.searchRead(
            uid,
            'hr.expense',
            [['employee_id', '=', parsedEmployeeId]],
            ['id', 'name', 'product_id', 'price_unit', 'quantity', 'total_amount', 'date', 'state', 'create_date']
        );
        res.json({ expenses });
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

        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const id = parseInt(employeeId as string);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid employee_id' });
        }

        const uid = await client.authenticate();
        const expenses: any = await client.searchRead(
            uid,
            'hr.expense',
            [['employee_id', '=', id], ['state', 'in', ['draft', 'reported']]],
            ['id', 'name', 'product_id', 'price_unit', 'quantity', 'total_amount', 'date', 'state', 'create_date']
        );
        res.json({ expenses });
    } catch (error: any) {
        console.error('Fetch Pending Expenses Error:', error);
        res.status(500).json({ error: error.message });
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
        let products: any[] = [];

        try {
            const result: any = await client.searchRead(
                uid,
                'product.product',
                [['can_be_expensed', '=', true]],
                ['id', 'name', 'standard_price']
            );
            products = Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('product.product can_be_expensed query failed, trying product.template fallback:', e);
        }

        if (products.length === 0) {
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
            } catch (e) {
                console.warn('product.template fallback also failed:', e);
            }
        }

        res.json({ products });
    } catch (error: any) {
        console.error('Fetch Expense Products Error:', error);
        res.json({ products: [], error: error.message });
    }
});

// POST / - Create Expense
router.post('/', async (req, res) => {
    try {
        const tenantId = (req as any).jwtPayload?.tenantId as string;
        const tenantConfig = await tenantStore.getTenant(tenantId);
        if (!tenantConfig) return res.status(401).json({ error: 'Unknown tenant' });
        const client = getOdooClient(tenantId, tenantConfig);

        const body = createExpenseSchema.parse(req.body);
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
        const companyId = employee.company_id[0];

        const companies: any = await client.searchRead(
            uid,
            'res.company',
            [['id', '=', companyId]],
            ['currency_id']
        );

        const currencyId = companies && companies[0] && companies[0].currency_id
            ? companies[0].currency_id[0]
            : 1;

        const baseExpenseData: Record<string, any> = {
            employee_id: body.employee_id,
            product_id: body.product_id,
            name: body.name,
            price_unit: body.unit_amount,
            quantity: body.quantity,
            date: body.date,
            company_id: companyId,
            currency_id: currencyId,
            payment_mode: 'own_account',
        };

        let newExpenseId: any;
        try {
            newExpenseId = await client.createRecord(uid, 'hr.expense', {
                ...baseExpenseData,
                total_amount_currency: body.unit_amount,
            });
        } catch (createErr: any) {
            const errMsg: string = String(createErr?.faultString || createErr?.message || '');
            if (errMsg.toLowerCase().includes('total_amount_currency') || errMsg.toLowerCase().includes('invalid field')) {
                console.warn('[expenses] total_amount_currency not accepted, retrying without it:', errMsg);
                newExpenseId = await client.createRecord(uid, 'hr.expense', baseExpenseData);
            } else {
                throw createErr;
            }
        }

        if (body.attachments && body.attachments.length > 0) {
            try {
                await client.uploadAttachments(uid, body.attachments, 'hr.expense', newExpenseId as number);
                console.log(`${body.attachments.length} attachment(s) uploaded for expense ${newExpenseId}`);
            } catch (attachError: any) {
                console.error('Attachment upload error:', attachError);
            }
        }

        res.json({ status: 'success', id: newExpenseId, state: 'draft', message: 'Expense created in draft state' });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Expense Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const expensesRouter = router;
