import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authRouter } from './routes/auth';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Shadow Portal Middleware is Active');
});

// Routes
app.use('/auth', authRouter);

app.listen(config.port, () => {
    console.log(`🚀 Server running on port ${config.port}`);
});
