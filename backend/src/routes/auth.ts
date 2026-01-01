import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { odooClient } from '../odoo/client';

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

export const authRouter = router;
