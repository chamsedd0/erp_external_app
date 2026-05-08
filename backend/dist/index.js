"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const auth_1 = require("./routes/auth");
const time_off_1 = require("./routes/time_off");
const expenses_1 = require("./routes/expenses");
const notifications_1 = require("./routes/notifications");
const timesheet_1 = require("./routes/timesheet");
const helpdesk_1 = require("./routes/helpdesk");
const maintenance_1 = require("./routes/maintenance");
const attendance_1 = require("./routes/attendance");
const cron_1 = require("./routes/cron");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app = (0, express_1.default)();
// Allow Authorization header in cross-origin requests (required for JWT)
app.use((0, cors_1.default)({ allowedHeaders: ['Content-Type', 'Authorization'] }));
// Increase JSON payload limit to support base64 attachments (up to 3 × 5 MB ≈ 15 MB)
app.use(express_1.default.json({ limit: '20mb' }));
// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// ── Rate Limiter: Max 200 requests per 15 mins ────────────────────────────────
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// ── Admin secret guard (runs before JWT middleware) ────────────────────────────
app.use('/admin', (req, res, next) => {
    if (req.headers['x-admin-secret'] !== config_1.config.adminSecret) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});
// ── JWT Middleware ─────────────────────────────────────────────────────────────
// All routes except /auth/* and /admin/* require a valid JWT.
app.use((req, res, next) => {
    if (req.path.startsWith('/auth/') || req.path.startsWith('/admin/') || req.path.startsWith('/cron/')) {
        return next();
    }
    const token = (req.headers.authorization ?? '').split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        req.jwtPayload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', auth_1.authRouter);
app.use('/admin', auth_1.adminRouter);
app.use('/cron', cron_1.cronRouter);
app.use('/time-off', time_off_1.timeOffRouter);
app.use('/expenses', expenses_1.expensesRouter);
app.use('/notifications', notifications_1.notificationsRouter);
app.use('/timesheet', timesheet_1.timesheetRouter);
app.use('/helpdesk', helpdesk_1.helpdeskRouter);
app.use('/maintenance', maintenance_1.maintenanceRouter);
app.use('/attendance', attendance_1.attendanceRouter);
// ── Local dev server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
    app.listen(config_1.config.port, () => {
        console.log(`🚀 Shadow Portal running on port ${config_1.config.port}`);
    });
}
exports.default = app;
