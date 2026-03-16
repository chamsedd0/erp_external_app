import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { timeOffRouter } from './routes/time_off';
import { expensesRouter } from './routes/expenses';
import { notificationsRouter } from './routes/notifications';
import { timesheetRouter } from './routes/timesheet';
import { helpdeskRouter } from './routes/helpdesk';
import { maintenanceRouter } from './routes/maintenance';
import { getOdooVersion } from './odoo/client';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(cors());
// Increase JSON payload limit to support base64 attachments (up to 3 × 5 MB ≈ 15 MB)
app.use(express.json({ limit: '20mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});

app.get('/health', async (req, res) => {
    try {
        const version = await getOdooVersion();
        res.json({
            status: 'ok',
            odoo_version: version,
            compatible: version >= 13,
            min_supported_version: 13,
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ── Rate Limiter: Max 200 requests per 15 mins ────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Increased from 100 to accommodate new modules
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/time-off', timeOffRouter);
app.use('/expenses', expensesRouter);
app.use('/notifications', notificationsRouter);
app.use('/timesheet', timesheetRouter);
app.use('/helpdesk', helpdeskRouter);
app.use('/maintenance', maintenanceRouter);

// ── Local dev server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.listen(config.port, () => {
        console.log(`🚀 Shadow Portal running on port ${config.port}`);
    });
}

export default app;
