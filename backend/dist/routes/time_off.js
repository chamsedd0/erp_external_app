"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeOffRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("../odoo/client");
const router = (0, express_1.Router)();
// Validation Schema for Time Off Request
const createLeaveSchema = zod_1.z.object({
    employee_id: zod_1.z.number(), // We'll look this up or pass it from frontend based on logged in user
    holiday_status_id: zod_1.z.number(), // Leave Type ID
    date_from: zod_1.z.string(), // ISO String
    date_to: zod_1.z.string(), // ISO String
    name: zod_1.z.string().optional(), // Description
});
// GET / - Fetch employee's time-off requests
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }
        const uid = await client_1.odooClient.authenticate();
        const leaves = await client_1.odooClient.searchRead(uid, 'hr.leave', [['employee_id', '=', parseInt(employeeId)]], ['id', 'name', 'holiday_status_id', 'date_from', 'date_to', 'number_of_days', 'state', 'create_date']);
        res.json({ leaves });
    }
    catch (error) {
        console.error('Fetch Leaves Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /types - Fetch Leave Types
router.get('/types', async (req, res) => {
    try {
        const uid = await client_1.odooClient.authenticate();
        // Fetch all leave types
        const types = await client_1.odooClient.searchRead(uid, 'hr.leave.type', [], // All records
        ['id', 'name', 'requires_allocation', 'request_unit']);
        res.json({ types });
    }
    catch (error) {
        console.error('Fetch Leave Types Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST / - Create Time Off Request
router.post('/', async (req, res) => {
    try {
        // In a real app, we'd extract employee_id from the JWT token.
        // For now, we trust the frontend to send the ID of the logged-in employee.
        const body = createLeaveSchema.parse(req.body);
        const uid = await client_1.odooClient.authenticate();
        // Convert ISO datetime to Odoo format (YYYY-MM-DD HH:MM:SS)
        const formatDatetime = (isoString) => isoString.replace('T', ' ').substring(0, 19);
        const newLeaveId = await client_1.odooClient.createRecord(uid, 'hr.leave', {
            employee_id: body.employee_id,
            holiday_status_id: body.holiday_status_id,
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            name: body.name || 'Time Off Request from Portal',
            request_date_from: body.date_from.split('T')[0], // Odoo often needs these for day-based counts
            request_date_to: body.date_to.split('T')[0],
        });
        res.json({ status: 'success', id: newLeaveId });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Create Leave Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.timeOffRouter = router;
