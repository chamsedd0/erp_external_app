import crypto from 'crypto';
import { config } from '../config';
import { redisDel, redisGet, redisSet, redisScan } from './redis';

export interface PortalCredential {
    tenantId: string;
    employeeId: number;
    workEmail?: string;
    name?: string;
    pinHash: string;
    activatedAt: string;
}

export interface ActivationInvite {
    tenantId: string;
    employeeId: number;
    workEmail?: string;
    name?: string;
    expiresAt: string;
}

function normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
}

function hashStable(value: string): string {
    return crypto
        .createHmac('sha256', config.portalAuthSecret)
        .update(value)
        .digest('hex');
}

function otpKey(tenantId: string, email: string) {
    return `shadow:t:${tenantId}:portal:otp:${hashStable(normaliseEmail(email))}`;
}

function credentialKey(tenantId: string, employeeId: number) {
    return `shadow:t:${tenantId}:portal:employee:${employeeId}`;
}

function emailIndexKey(tenantId: string, email: string) {
    return `shadow:t:${tenantId}:portal:email:${hashStable(normaliseEmail(email))}`;
}

function inviteKey(code: string) {
    return `shadow:portal:invite:${hashStable(code.trim().toUpperCase())}`;
}

function randomDigits(length = 6): string {
    const max = 10 ** length;
    return crypto.randomInt(0, max).toString().padStart(length, '0');
}

function randomInviteCode(): string {
    return crypto.randomBytes(9).toString('base64url').toUpperCase();
}

function hashPin(pin: string): string {
    const iterations = 120_000;
    const salt = crypto.randomBytes(16).toString('base64url');
    const hash = crypto.pbkdf2Sync(pin, salt, iterations, 32, 'sha256').toString('base64url');
    return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
    const [kind, iterationsRaw, salt, expected] = stored.split('$');
    if (kind !== 'pbkdf2' || !iterationsRaw || !salt || !expected) return false;
    const iterations = Number.parseInt(iterationsRaw, 10);
    const actual = crypto.pbkdf2Sync(pin, salt, iterations, 32, 'sha256').toString('base64url');
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export const portalAuthStore = {
    normaliseEmail,

    validatePinPolicy(pin: string): string | null {
        if (!/^\d{4,12}$/.test(pin)) return 'PIN must be 4 to 12 digits.';
        if (/^(\d)\1+$/.test(pin)) return 'PIN cannot use the same digit repeated.';
        return null;
    },

    async createOtp(tenantId: string, employeeId: number, workEmail: string, name?: string) {
        const otp = randomDigits();
        const expiresAt = new Date(Date.now() + config.activationOtpTtlSeconds * 1000).toISOString();
        await redisSet(
            otpKey(tenantId, workEmail),
            JSON.stringify({
                tenantId,
                employeeId,
                workEmail: normaliseEmail(workEmail),
                name,
                otpHash: hashStable(otp),
                expiresAt,
            }),
            config.activationOtpTtlSeconds
        );
        return { otp, expiresAt };
    },

    async verifyOtp(tenantId: string, workEmail: string, otp: string) {
        const key = otpKey(tenantId, workEmail);
        const raw = await redisGet(key);
        if (!raw) return null;
        const entry = JSON.parse(raw) as {
            tenantId: string;
            employeeId: number;
            workEmail: string;
            name?: string;
            otpHash: string;
            expiresAt: string;
        };
        if (entry.tenantId !== tenantId || new Date(entry.expiresAt).getTime() < Date.now()) {
            await redisDel(key);
            return null;
        }
        if (entry.otpHash !== hashStable(otp.trim())) return null;
        await redisDel(key);
        return entry;
    },

    async saveCredential(input: Omit<PortalCredential, 'pinHash' | 'activatedAt'> & { pin: string }) {
        const credential: PortalCredential = {
            tenantId: input.tenantId,
            employeeId: input.employeeId,
            workEmail: input.workEmail ? normaliseEmail(input.workEmail) : undefined,
            name: input.name,
            pinHash: hashPin(input.pin),
            activatedAt: new Date().toISOString(),
        };
        await redisSet(credentialKey(input.tenantId, input.employeeId), JSON.stringify(credential));
        if (credential.workEmail) {
            await redisSet(emailIndexKey(input.tenantId, credential.workEmail), String(input.employeeId));
        }
        return credential;
    },

    async getCredential(tenantId: string, employeeId: number): Promise<PortalCredential | null> {
        const raw = await redisGet(credentialKey(tenantId, employeeId));
        if (!raw) return null;
        return JSON.parse(raw) as PortalCredential;
    },

    async getCredentialByEmail(tenantId: string, workEmail: string): Promise<PortalCredential | null> {
        const employeeIdRaw = await redisGet(emailIndexKey(tenantId, workEmail));
        const employeeId = Number.parseInt(String(employeeIdRaw ?? ''), 10);
        if (!Number.isInteger(employeeId)) return null;
        return this.getCredential(tenantId, employeeId);
    },

    async verifyCredential(credential: PortalCredential | null, pin: string): Promise<boolean> {
        if (!credential) return false;
        return verifyPin(pin, credential.pinHash);
    },

    async createInvite(input: Omit<ActivationInvite, 'expiresAt'>) {
        const code = randomInviteCode();
        const invite: ActivationInvite = {
            tenantId: input.tenantId,
            employeeId: input.employeeId,
            workEmail: input.workEmail ? normaliseEmail(input.workEmail) : undefined,
            name: input.name,
            expiresAt: new Date(Date.now() + config.activationInviteTtlSeconds * 1000).toISOString(),
        };
        await redisSet(inviteKey(code), JSON.stringify(invite), config.activationInviteTtlSeconds);
        return { code, ...invite };
    },

    async consumeInvite(tenantId: string, code: string): Promise<ActivationInvite | null> {
        const key = inviteKey(code);
        const raw = await redisGet(key);
        if (!raw) return null;
        const invite = JSON.parse(raw) as ActivationInvite;
        if (invite.tenantId !== tenantId || new Date(invite.expiresAt).getTime() < Date.now()) {
            await redisDel(key);
            return null;
        }
        await redisDel(key);
        return invite;
    },

    async listCredentials(tenantId: string): Promise<Array<Omit<PortalCredential, 'pinHash'>>> {
        const keys = await redisScan(`shadow:t:${tenantId}:portal:employee:*`);
        const results: Array<Omit<PortalCredential, 'pinHash'>> = [];
        for (const key of keys) {
            const raw = await redisGet(key).catch(() => null);
            if (!raw) continue;
            const { pinHash: _pinHash, ...safe } = JSON.parse(raw) as PortalCredential;
            results.push(safe);
        }
        return results.sort((a, b) => a.employeeId - b.employeeId);
    },
};
