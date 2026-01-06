"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const auth_1 = require("./routes/auth");
const time_off_1 = require("./routes/time_off");
const expenses_1 = require("./routes/expenses");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});
// Rate Limiter: Max 100 requests per 15 mins
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Routes
app.use('/auth', auth_1.authRouter);
app.use('/time-off', time_off_1.timeOffRouter);
app.use('/expenses', expenses_1.expensesRouter);
if (process.env.NODE_ENV !== 'production') {
    app.listen(config_1.config.port, () => {
        console.log(`🚀 Server running on port ${config_1.config.port}`);
    });
}
exports.default = app;
