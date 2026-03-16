import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
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

// Allow Authorization header in cross-origin requests (required for JWT)
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization'] }));
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

// ── JWT Middleware ─────────────────────────────────────────────────────────────
// All routes except /auth/* require a valid JWT. Auth routes are self-managing
// (login issues the token; push-token registration happens right after login).
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/auth/')) {
        return next();
    }
    const token = (req.headers.authorization ?? '').split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        (req as any).jwtPayload = jwt.verify(token, config.jwtSecret);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

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
