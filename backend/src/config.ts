import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    JWT_SECRET: z.string(),
    ADMIN_SECRET: z.string(),
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
    jwtSecret: envVars.data.JWT_SECRET,
    adminSecret: envVars.data.ADMIN_SECRET,
    upstash: {
        url: envVars.data.UPSTASH_REDIS_REST_URL,
        token: envVars.data.UPSTASH_REDIS_REST_TOKEN,
    },
};
