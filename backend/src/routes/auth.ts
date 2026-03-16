import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { odooClient } from '../odoo/client';
import { pushStore } from '../lib/pushStore';

const router = Router();

const loginSchema = z.object({
    employee_id: z.string(),
    pin: z.string(),
});

router.post('/login', async (req, res) => {
    try {
        const { employee_id, pin } = loginSchema.parse(req.body);

        // 1. Authenticate Admin to get UID (This could be cached)
        const uid = await odooClient.authenticate();

        // 2. Search for Employee
        const employees: any = await odooClient.searchEmployee(uid, employee_id, pin);

        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const employee = employees[0];

        // 3. Generate JWT
        const token = jwt.sign(
            {
                id: employee.id,
                name: employee.name,
                role: 'employee'
            },
            config.jwtSecret,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                department: employee.department_id ? employee.department_id[1] : null,
                job_title: employee.job_title,
            },
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Push Notification Token Management ───────────────────────────────────────

const pushTokenSchema = z.object({
    employee_id: z.number(),
    token: z.string().min(1),
});

/**
 * POST /auth/push-token
 * Saves an Expo push token for the given employee.
 * Called from the frontend after the user grants notification permission.
 */
router.post('/push-token', async (req, res) => {
    try {
        const { employee_id, token } = pushTokenSchema.parse(req.body);
        await pushStore.saveToken(employee_id, token);
        res.json({ success: true });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error('Save Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /auth/push-token
 * Removes the Expo push token for the given employee.
 * Called on logout so the device no longer receives notifications.
 */
router.delete('/push-token', async (req, res) => {
    try {
        const employeeId = req.body?.employee_id ?? req.query?.employee_id;
        if (!employeeId) {
            return res.status(400).json({ error: 'employee_id is required' });
        }
        await pushStore.removeToken(parseInt(String(employeeId)));
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete Push Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export const authRouter = router;
