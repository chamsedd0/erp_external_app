import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    ODOO_URL: z.string(),
    ODOO_DB: z.string(),
    ODOO_USERNAME: z.string(),
    ODOO_PASSWORD: z.string(),
    JWT_SECRET: z.string(),
    UPSTASH_REDIS_REST_URL: z.string(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
    console.error('❌ Invalid environment variables:', envVars.error.format());
    process.exit(1);
}

export const config = {
    port: parseInt(envVars.data.PORT, 10),
    odoo: {
        url: envVars.data.ODOO_URL,
        db: envVars.data.ODOO_DB,
        username: envVars.data.ODOO_USERNAME,
        password: envVars.data.ODOO_PASSWORD,
    },
    jwtSecret: envVars.data.JWT_SECRET,
    upstash: {
        url: envVars.data.UPSTASH_REDIS_REST_URL,
        token: envVars.data.UPSTASH_REDIS_REST_TOKEN,
    },
};
