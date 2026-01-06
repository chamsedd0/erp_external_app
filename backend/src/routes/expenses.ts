import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';

const router = Router();

// Validation Schema for Expense
const createExpenseSchema = z.object({
    employee_id: z.number(),
    product_id: z.number(),
    name: z.string(), // Description
    price_unit: z.number(), // Cost per unit (this is the correct field)
    quantity: z.number().default(1),
    date: z.string(), // YYYY-MM-DD
    receipt: z.string().optional(), // Base64 encoded receipt image
});

// GET / - Fetch user's expenses
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }

        const uid = await odooClient.authenticate();
        const expenses: any = await odooClient.searchRead(
            uid,
            'hr.expense',
            [['employee_id', '=', parseInt(employeeId as string)]],
            ['id', 'name', 'product_id', 'price_unit', 'quantity', 'total_amount', 'date', 'state', 'create_date']
        );
        res.json({ expenses });
    } catch (error: any) {
        console.error('Fetch Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /products - Fetch Expense Products
router.get('/products', async (req, res) => {
    try {
        const uid = await odooClient.authenticate();
        // Fetch products that can be expensed
        const products: any = await odooClient.searchRead(
            uid,
            'product.product',
            [['can_be_expensed', '=', true]],
            ['id', 'name', 'standard_price']
        );
        res.json({ products });
    } catch (error: any) {
        console.error('Fetch Expense Products Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST / - Create Expense
router.post('/', async (req, res) => {
    try {
        const body = createExpenseSchema.parse(req.body);
        const uid = await odooClient.authenticate();

        // Step 1: Get employee's company_id and currency
        const employees: any = await odooClient.searchRead(
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

        // Fetch the currency from the company
        const companies: any = await odooClient.searchRead(
            uid,
            'res.company',
            [['id', '=', companyId]],
            ['currency_id']
        );

        const currencyId = companies && companies[0] && companies[0].currency_id
            ? companies[0].currency_id[0]
            : 1; // Default to currency ID 1 if not set

        // Step 2: Create expense record with all required fields
        const newExpenseId = await odooClient.createRecord(uid, 'hr.expense', {
            employee_id: body.employee_id,
            product_id: body.product_id,
            name: body.name,
            price_unit: body.price_unit, // This is the correct field name
            quantity: body.quantity,
            date: body.date,
            company_id: companyId, // Required field
            currency_id: currencyId, // Required field
            payment_mode: 'own_account', // Employee paid, needs reimbursement
        });

        // Step 3: If receipt provided, create attachment
        if (body.receipt) {
            try {
                await odooClient.createAttachment(
                    uid,
                    `${body.name}_receipt.jpg`,
                    body.receipt,
                    'hr.expense',
                    newExpenseId as number,
                    'image/jpeg'
                );
                console.log(`Receipt attached to expense ${newExpenseId}`);
            } catch (attachError: any) {
                console.error('Attachment Error:', attachError);
                // Continue even if attachment fails
            }
        }

        // Step 4: Submit the expense (change state from draft to reported)
        try {
            await odooClient.callMethod(uid, 'hr.expense', 'action_submit_expenses', [newExpenseId as number]);
            console.log(`Expense ${newExpenseId} submitted successfully`);
        } catch (submitError: any) {
            console.error('Submit Error:', submitError);
            // Return success but note submission failed
            return res.json({
                status: 'created_not_submitted',
                id: newExpenseId,
                message: 'Expense created but submission failed. It remains in draft state.'
            });
        }

        res.json({ status: 'success', id: newExpenseId, state: 'reported' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Expense Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const expensesRouter = router;
