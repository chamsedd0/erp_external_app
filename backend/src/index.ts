import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { authRouter, adminRouter } from './routes/auth';
import { timeOffRouter } from './routes/time_off';
import { expensesRouter } from './routes/expenses';
import { notificationsRouter } from './routes/notifications';
import { timesheetRouter } from './routes/timesheet';
import { helpdeskRouter } from './routes/helpdesk';
import { maintenanceRouter } from './routes/maintenance';
import { attendanceRouter } from './routes/attendance';
import { companiesRouter } from './routes/companies';
import { optionsRouter } from './routes/options';
import { cronRouter } from './routes/cron';
import { pushError } from './lib/errorLog';
import rateLimit from 'express-rate-limit';


const app = express();

// Allow Authorization header in cross-origin requests (required for JWT)
app.use(cors({ allowedHeaders: ['Content-Type', 'Authorization', 'X-Lang'] }));
// Increase JSON payload limit to support base64 attachments (up to 3 × 5 MB ≈ 15 MB)
app.use(express.json({ limit: '20mb' }));

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const originalJson = res.json.bind(res);
    (res as any).json = function (body: any) {
        if (res.statusCode >= 500) {
            const tenantId = (req as any).jwtPayload?.tenantId as string | undefined;
            if (tenantId) {
                const errorMsg = (typeof body === 'object' && body?.error)
                    ? String(body.error).slice(0, 500)
                    : 'Internal server error';
                void pushError(tenantId, {
                    timestamp: new Date().toISOString(),
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    error: errorMsg,
                    employee_id: (req as any).jwtPayload?.id,
                });
            }
        }
        return originalJson(body);
    };
    next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// ── Rate Limiter: Max 600 requests per 15 mins ────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// ── Admin secret guard (runs before JWT middleware) ────────────────────────────
app.use('/admin', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers['x-admin-secret'] !== config.adminSecret) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

// ── JWT Middleware ─────────────────────────────────────────────────────────────
// All routes except /auth/* and /admin/* require a valid JWT.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const publicAuthPaths = [
        /^\/auth\/login$/,
        /^\/auth\/tenant\/[^/]+$/,
        /^\/auth\/activation\//,
    ];
    if (req.path.startsWith('/admin/') || req.path.startsWith('/cron/') || publicAuthPaths.some(re => re.test(req.path))) {
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
app.use('/admin', adminRouter);
app.use('/cron', cronRouter);
app.use('/time-off', timeOffRouter);
app.use('/expenses', expensesRouter);
app.use('/notifications', notificationsRouter);
app.use('/timesheet', timesheetRouter);
app.use('/helpdesk', helpdeskRouter);
app.use('/maintenance', maintenanceRouter);
app.use('/attendance', attendanceRouter);
app.use('/companies', companiesRouter);
app.use('/options', optionsRouter);

// ── Error-handling middleware — catches errors thrown/forwarded by handlers ───
// Registered AFTER all routes. Express recognises it as an error handler by its
// four-argument signature. Complements the res.json wrapper above (which logs
// explicit 5xx responses) by also capturing thrown/uncaught route errors.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const tenantId = (req as any).jwtPayload?.tenantId as string | undefined;
    if (tenantId) {
        void pushError(tenantId, {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: 500,
            error: String(err?.message ?? err ?? 'Internal server error').slice(0, 500),
            employee_id: (req as any).jwtPayload?.id,
        });
    } else {
        console.error('Unhandled error:', err);
    }
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error' });
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.listen(config.port, () => {
        console.log(`🚀 Shadow Portal running on port ${config.port}`);
    });
}

export default app;
