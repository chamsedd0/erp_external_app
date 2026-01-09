import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { timeOffRouter } from './routes/time_off';
import { expensesRouter } from './routes/expenses';
import { notificationsRouter } from './routes/notifications';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});

// Rate Limiter: Max 100 requests per 15 mins
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Routes
app.use('/auth', authRouter);
app.use('/time-off', timeOffRouter);
app.use('/expenses', expensesRouter);
app.use('/notifications', notificationsRouter);

if (process.env.NODE_ENV !== 'production') {
    app.listen(config.port, () => {
        console.log(`🚀 Server running on port ${config.port}`);
    });
}

export default app;
