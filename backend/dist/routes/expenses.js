"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const router = (0, express_1.Router)();
// Validation Schema for Expense
const createExpenseSchema = zod_1.z.object({
    employee_id: zod_1.z.number(),
    product_id: zod_1.z.number(),
    name: zod_1.z.string(), // Description
    unit_amount: zod_1.z.number(), // Cost per unit (FIXED: was price_unit)
    quantity: zod_1.z.number().default(1),
    date: zod_1.z.string(), // YYYY-MM-DD
    receipt: zod_1.z.string().optional(), // Base64 encoded receipt image
});
// GET / - Fetch user's expenses
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const uid = await client_1.odooClient.authenticate();
        const expenses = await client_1.odooClient.searchRead(uid, 'hr.expense', [['employee_id', '=', parseInt(employeeId)]], ['id', 'name', 'product_id', 'unit_amount', 'quantity', 'total_amount', 'date', 'state', 'create_date']);
        res.json({ expenses });
    }
    catch (error) {
        console.error('Fetch Expenses Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /products - Fetch Expense Products
router.get('/products', async (req, res) => {
    try {
        const uid = await client_1.odooClient.authenticate();
        // Fetch products that can be expensed
        const products = await client_1.odooClient.searchRead(uid, 'product.product', [['can_be_expensed', '=', true]], ['id', 'name', 'standard_price']);
        res.json({ products });
    }
    catch (error) {
        console.error('Fetch Expense Products Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST / - Create Expense
router.post('/', async (req, res) => {
    try {
        const body = createExpenseSchema.parse(req.body);
        const uid = await client_1.odooClient.authenticate();
        // Step 1: Create expense record with correct field name
        const newExpenseId = await client_1.odooClient.createRecord(uid, 'hr.expense', {
            employee_id: body.employee_id,
            product_id: body.product_id,
            name: body.name,
            unit_amount: body.unit_amount, // FIXED: Changed from price_unit to unit_amount
            quantity: body.quantity,
            date: body.date,
            payment_mode: 'own_account', // Employee paid, needs reimbursement
        });
        // Step 2: If receipt provided, create attachment
        if (body.receipt) {
            try {
                await client_1.odooClient.createAttachment(uid, `${body.name}_receipt.jpg`, body.receipt, 'hr.expense', newExpenseId, 'image/jpeg');
                console.log(`Receipt attached to expense ${newExpenseId}`);
            }
            catch (attachError) {
                console.error('Attachment Error:', attachError);
                // Continue even if attachment fails
            }
        }
        // Step 3: Submit the expense (change state from draft to reported)
        try {
            await client_1.odooClient.callMethod(uid, 'hr.expense', 'action_submit_expenses', [newExpenseId]);
            console.log(`Expense ${newExpenseId} submitted successfully`);
        }
        catch (submitError) {
            console.error('Submit Error:', submitError);
            // Return success but note submission failed
            return res.json({
                status: 'created_not_submitted',
                id: newExpenseId,
                message: 'Expense created but submission failed. It remains in draft state.'
            });
        }
        res.json({ status: 'success', id: newExpenseId, state: 'reported' });
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
