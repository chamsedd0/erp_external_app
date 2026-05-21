"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalAuthStore = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const redis_1 = require("./redis");
function normaliseEmail(email) {
    return email.trim().toLowerCase();
}
function hashStable(value) {
    return crypto_1.default
        .createHmac('sha256', config_1.config.portalAuthSecret)
        .update(value)
        .digest('hex');
}
function otpKey(tenantId, email) {
    return `shadow:t:${tenantId}:portal:otp:${hashStable(normaliseEmail(email))}`;
}
function credentialKey(tenantId, employeeId) {
    return `shadow:t:${tenantId}:portal:employee:${employeeId}`;
}
function emailIndexKey(tenantId, email) {
    return `shadow:t:${tenantId}:portal:email:${hashStable(normaliseEmail(email))}`;
}
function inviteKey(code) {
    return `shadow:portal:invite:${hashStable(code.trim().toUpperCase())}`;
}
function randomDigits(length = 6) {
    const max = 10 ** length;
    return crypto_1.default.randomInt(0, max).toString().padStart(length, '0');
}
function randomInviteCode() {
    return crypto_1.default.randomBytes(9).toString('base64url').toUpperCase();
}
function hashPin(pin) {
    const iterations = 120000;
    const salt = crypto_1.default.randomBytes(16).toString('base64url');
    const hash = crypto_1.default.pbkdf2Sync(pin, salt, iterations, 32, 'sha256').toString('base64url');
    return `pbkdf2$${iterations}$${salt}$${hash}`;
}
function verifyPin(pin, stored) {
    const [kind, iterationsRaw, salt, expected] = stored.split('$');
    if (kind !== 'pbkdf2' || !iterationsRaw || !salt || !expected)
        return false;
    const iterations = Number.parseInt(iterationsRaw, 10);
    const actual = crypto_1.default.pbkdf2Sync(pin, salt, iterations, 32, 'sha256').toString('base64url');
    return crypto_1.default.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
exports.portalAuthStore = {
    normaliseEmail,
    validatePinPolicy(pin) {
        if (!/^\d{4,12}$/.test(pin))
            return 'PIN must be 4 to 12 digits.';
        if (/^(\d)\1+$/.test(pin))
            return 'PIN cannot use the same digit repeated.';
        return null;
    },
    async createOtp(tenantId, employeeId, workEmail, name) {
        const otp = randomDigits();
        const expiresAt = new Date(Date.now() + config_1.config.activationOtpTtlSeconds * 1000).toISOString();
        await (0, redis_1.redisSet)(otpKey(tenantId, workEmail), JSON.stringify({
            tenantId,
            employeeId,
            workEmail: normaliseEmail(workEmail),
            name,
            otpHash: hashStable(otp),
            expiresAt,
        }), config_1.config.activationOtpTtlSeconds);
        return { otp, expiresAt };
    },
    async verifyOtp(tenantId, workEmail, otp) {
        const key = otpKey(tenantId, workEmail);
        const raw = await (0, redis_1.redisGet)(key);
        if (!raw)
            return null;
        const entry = JSON.parse(raw);
        if (entry.tenantId !== tenantId || new Date(entry.expiresAt).getTime() < Date.now()) {
            await (0, redis_1.redisDel)(key);
            return null;
        }
        if (entry.otpHash !== hashStable(otp.trim()))
            return null;
        await (0, redis_1.redisDel)(key);
        return entry;
    },
    async saveCredential(input) {
        const credential = {
            tenantId: input.tenantId,
            employeeId: input.employeeId,
            workEmail: input.workEmail ? normaliseEmail(input.workEmail) : undefined,
            name: input.name,
            pinHash: hashPin(input.pin),
            activatedAt: new Date().toISOString(),
        };
        await (0, redis_1.redisSet)(credentialKey(input.tenantId, input.employeeId), JSON.stringify(credential));
        if (credential.workEmail) {
            await (0, redis_1.redisSet)(emailIndexKey(input.tenantId, credential.workEmail), String(input.employeeId));
        }
        return credential;
    },
    async getCredential(tenantId, employeeId) {
        const raw = await (0, redis_1.redisGet)(credentialKey(tenantId, employeeId));
        if (!raw)
            return null;
        return JSON.parse(raw);
    },
    async getCredentialByEmail(tenantId, workEmail) {
        const employeeIdRaw = await (0, redis_1.redisGet)(emailIndexKey(tenantId, workEmail));
        const employeeId = Number.parseInt(String(employeeIdRaw ?? ''), 10);
        if (!Number.isInteger(employeeId))
            return null;
        return this.getCredential(tenantId, employeeId);
    },
    async verifyCredential(credential, pin) {
        if (!credential)
            return false;
        return verifyPin(pin, credential.pinHash);
    },
    async createInvite(input) {
        const code = randomInviteCode();
        const invite = {
            tenantId: input.tenantId,
            employeeId: input.employeeId,
            workEmail: input.workEmail ? normaliseEmail(input.workEmail) : undefined,
            name: input.name,
            expiresAt: new Date(Date.now() + config_1.config.activationInviteTtlSeconds * 1000).toISOString(),
        };
        await (0, redis_1.redisSet)(inviteKey(code), JSON.stringify(invite), config_1.config.activationInviteTtlSeconds);
        return { code, ...invite };
    },
    async consumeInvite(tenantId, code) {
        const key = inviteKey(code);
        const raw = await (0, redis_1.redisGet)(key);
        if (!raw)
            return null;
        const invite = JSON.parse(raw);
        if (invite.tenantId !== tenantId || new Date(invite.expiresAt).getTime() < Date.now()) {
            await (0, redis_1.redisDel)(key);
            return null;
        }
        await (0, redis_1.redisDel)(key);
        return invite;
    },
    async listCredentials(tenantId) {
        const keys = await (0, redis_1.redisScan)(`shadow:t:${tenantId}:portal:employee:*`);
        const results = [];
        for (const key of keys) {
            const raw = await (0, redis_1.redisGet)(key).catch(() => null);
            if (!raw)
                continue;
            const { pinHash: _pinHash, ...safe } = JSON.parse(raw);
            results.push(safe);
        }
        return results.sort((a, b) => a.employeeId - b.employeeId);
    },
};
