import { Router } from 'express';
import { z } from 'zod';
import { odooClient } from '../odoo/client';
import { config } from '../config';

const router = Router();

// Shared attachment schema
const attachmentSchema = z.object({
    name: z.string(),
    data: z.string(),     // base64
    mimetype: z.string(),
});

// Validation Schema for Time Off Request
const createLeaveSchema = z.object({
    employee_id: z.number(),
    holiday_status_id: z.number(), // Leave Type ID
    date_from: z.string(), // ISO String
    date_to: z.string(),   // ISO String
    name: z.string().optional(), // Description / reason
    attachments: z.array(attachmentSchema).max(3).optional(), // Supporting documents
});

// GET / - Fetch employee's time-off requests
router.get('/', async (req, res) => {
    try {
        const employeeId = req.query.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id query parameter required' });
        }

        const uid = await odooClient.authenticate();
        const leaves: any = await odooClient.searchRead(
            uid,
            'hr.leave',
            [['employee_id', '=', parseInt(employeeId as string)]],
            ['id', 'name', 'holiday_status_id', 'date_from', 'date_to', 'number_of_days', 'state', 'create_date']
        );
        res.json({ leaves });
    } catch (error: any) {
        console.error('Fetch Leaves Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /types - Fetch Leave Types
router.get('/types', async (req, res) => {
    try {
        const uid = await odooClient.authenticate();
        // Fetch all leave types
        const types: any = await odooClient.searchRead(
            uid,
            'hr.leave.type',
            [], // All records
            ['id', 'name', 'requires_allocation', 'request_unit']
        );
        res.json({ types });
    } catch (error: any) {
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

        const uid = await odooClient.authenticate();

        // Convert ISO datetime to Odoo format (YYYY-MM-DD HH:MM:SS)
        const formatDatetime = (isoString: string) => isoString.replace('T', ' ').substring(0, 19);

        const newLeaveId = await odooClient.createRecord(uid, 'hr.leave', {
            employee_id: body.employee_id,
            holiday_status_id: body.holiday_status_id,
            date_from: formatDatetime(body.date_from),
            date_to: formatDatetime(body.date_to),
            name: body.name || 'Time Off Request from Portal',
            request_date_from: body.date_from.split('T')[0], // Odoo often needs these for day-based counts
            request_date_to: body.date_to.split('T')[0],
        });

        // Upload supporting documents if provided (e.g. medical certificate)
        if (body.attachments && body.attachments.length > 0) {
            try {
                await odooClient.uploadAttachments(uid, body.attachments, 'hr.leave', newLeaveId as number);
            } catch (attachError: any) {
                console.error('Leave attachment upload error:', attachError);
                // Don't fail the whole request for attachment errors
            }
        }

        res.json({ status: 'success', id: newLeaveId });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Create Leave Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const timeOffRouter = router;
