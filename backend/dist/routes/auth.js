"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const client_1 = require("../odoo/client");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    employee_id: zod_1.z.string(),
    pin: zod_1.z.string(),
});
router.post('/login', async (req, res) => {
    try {
        const { employee_id, pin } = loginSchema.parse(req.body);
        // 1. Authenticate Admin to get UID (This could be cached)
        const uid = await client_1.odooClient.authenticate();
        // 2. Search for Employee
        const employees = await client_1.odooClient.searchEmployee(uid, employee_id, pin);
        if (!employees || employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const employee = employees[0];
        // 3. Generate JWT
        const token = jsonwebtoken_1.default.sign({
            id: employee.id,
            name: employee.name,
            role: 'employee'
        }, config_1.config.jwtSecret, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                department: employee.department_id ? employee.department_id[1] : null,
                job_title: employee.job_title,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: error.errors });
        }
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.authRouter = router;
