import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('3000'),
    JWT_SECRET: z.string(),
    ADMIN_SECRET: z.string(),
    UPSTASH_REDIS_REST_URL: z.string(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    PORTAL_AUTH_SECRET: z.string().optional(),
    ACTIVATION_OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    ACTIVATION_INVITE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
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
    resendApiKey: envVars.data.RESEND_API_KEY ?? '',
    resendFromEmail: envVars.data.RESEND_FROM_EMAIL ?? 'billing@shadowportal.app',
    cronSecret: envVars.data.CRON_SECRET ?? '',
    portalAuthSecret: envVars.data.PORTAL_AUTH_SECRET ?? envVars.data.JWT_SECRET,
    activationOtpTtlSeconds: envVars.data.ACTIVATION_OTP_TTL_SECONDS,
    activationInviteTtlSeconds: envVars.data.ACTIVATION_INVITE_TTL_SECONDS,
};
