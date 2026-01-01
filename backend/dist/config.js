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
    ODOO_URL: zod_1.z.string(),
    ODOO_DB: zod_1.z.string(),
    ODOO_USERNAME: zod_1.z.string(),
    ODOO_PASSWORD: zod_1.z.string(),
    JWT_SECRET: zod_1.z.string(),
});
const envVars = envSchema.safeParse(process.env);
if (!envVars.success) {
    console.error('❌ Invalid environment variables:', envVars.error.format());
    process.exit(1);
}
exports.config = {
    port: parseInt(envVars.data.PORT, 10),
    odoo: {
        url: envVars.data.ODOO_URL,
        db: envVars.data.ODOO_DB,
        username: envVars.data.ODOO_USERNAME,
        password: envVars.data.ODOO_PASSWORD,
    },
    jwtSecret: envVars.data.JWT_SECRET,
};
