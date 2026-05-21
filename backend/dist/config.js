"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    JWT_SECRET: zod_1.z.string(),
    ADMIN_SECRET: zod_1.z.string(),
    UPSTASH_REDIS_REST_URL: zod_1.z.string(),
    UPSTASH_REDIS_REST_TOKEN: zod_1.z.string(),
    RESEND_API_KEY: zod_1.z.string().optional(),
    RESEND_FROM_EMAIL: zod_1.z.string().optional(),
    CRON_SECRET: zod_1.z.string().optional(),
    PORTAL_AUTH_SECRET: zod_1.z.string().optional(),
    ACTIVATION_OTP_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(600),
    ACTIVATION_INVITE_TTL_SECONDS: zod_1.z.coerce.number().int().positive().default(86400),
});
const envVars = envSchema.safeParse(process.env);
if (!envVars.success) {
    console.error('❌ Invalid environment variables:', envVars.error.format());
    process.exit(1);
}
exports.config = {
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
