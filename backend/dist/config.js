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
};
