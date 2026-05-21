import { redisGet, redisSet, redisDel, redisScan } from './redis';

const tokenKey = (tenantId: string, employeeId: number) => `shadow:t:${tenantId}:push_token:${employeeId}`;
const registrationKey = (tenantId: string, employeeId: number) => `shadow:t:${tenantId}:app_registration:${employeeId}`;

interface PushTokenEntry {
    employeeId: number;
    token: string;
    updatedAt: string;
}

export interface AppRegistrationEntry {
    employeeId: number;
    registeredAt: string;
    lastSeenAt: string;
    source: 'push_token' | 'registration';
}

// ── Public store API ──────────────────────────────────────────────────────────

export const pushStore = {
    /** Save or update the Expo push token for an employee. */
    saveToken: async (tenantId: string, employeeId: number, token: string): Promise<void> => {
        const entry: PushTokenEntry = { employeeId, token, updatedAt: new Date().toISOString() };
        await redisSet(tokenKey(tenantId, employeeId), JSON.stringify(entry));
        await pushStore.saveRegistration(tenantId, employeeId);
    },

    /** Persist an app user registration for billing/account counting. Logout must not remove this. */
    saveRegistration: async (tenantId: string, employeeId: number): Promise<void> => {
        const now = new Date().toISOString();
        let registeredAt = now;
        try {
            const raw = await redisGet(registrationKey(tenantId, employeeId));
            if (raw) {
                const existing = JSON.parse(raw) as Partial<AppRegistrationEntry>;
                registeredAt = existing.registeredAt || now;
            }
        } catch { /* overwrite malformed registration */ }

        const entry: AppRegistrationEntry = {
            employeeId,
            registeredAt,
            lastSeenAt: now,
            source: 'registration',
        };
        await redisSet(registrationKey(tenantId, employeeId), JSON.stringify(entry));
    },

    /** Get the Expo push token for an employee. Returns null if not registered. */
    getToken: async (tenantId: string, employeeId: number): Promise<string | null> => {
        try {
            const raw = await redisGet(tokenKey(tenantId, employeeId));
            if (!raw) return null;
            const entry: PushTokenEntry = JSON.parse(raw);
            return entry.token;
        } catch {
            return null;
        }
    },

    /** Remove the push token for an employee (called on logout). Registration remains billable. */
    removeToken: async (tenantId: string, employeeId: number): Promise<void> => {
        await redisDel(tokenKey(tenantId, employeeId));
    },

    /** Remove a persistent app registration, used only for explicit account/device deletion. */
    deleteRegistration: async (tenantId: string, employeeId: number): Promise<void> => {
        await redisDel(tokenKey(tenantId, employeeId));
        await redisDel(registrationKey(tenantId, employeeId));
    },

    /**
     * List every registered push token across all tenants.
     * Returns an array of { tenantId, employeeId } pairs.
     * Used by the cron job to know who to check.
     */
    listAllTokens: async (): Promise<{ tenantId: string; employeeId: number }[]> => {
        try {
            const keys = await redisScan('shadow:t:*:push_token:*');
            return keys.map(key => {
                // key format: shadow:t:<tenantId>:push_token:<employeeId>
                const parts = key.split(':');
                const tenantId = parts[2];
                const employeeId = parseInt(parts[4], 10);
                return { tenantId, employeeId };
            }).filter(e => !isNaN(e.employeeId));
        } catch {
            return [];
        }
    },

    /**
     * List all registered devices for a specific tenant.
     * Returns partial token previews (first 12 chars + "…") for display.
     */
    listDevicesForTenant: async (tenantId: string): Promise<{ employeeId: number; token_preview: string; registered_at: string }[]> => {
        try {
            const keys = await redisScan(`shadow:t:${tenantId}:push_token:*`);
            const results: { employeeId: number; token_preview: string; registered_at: string }[] = [];
            for (const key of keys) {
                try {
                    const raw = await redisGet(key);
                    if (!raw) continue;
                    const entry: PushTokenEntry = JSON.parse(raw);
                    results.push({
                        employeeId: entry.employeeId,
                        token_preview: entry.token.slice(0, 20) + '…',
                        registered_at: entry.updatedAt,
                    });
                } catch { /* skip malformed */ }
            }
            return results.sort((a, b) => a.employeeId - b.employeeId);
        } catch {
            return [];
        }
    },

    /**
     * List unique registered app users for billing.
     * Legacy push-token records with employee IDs count as registrations until users refresh onto the new store.
     */
    listRegisteredUsersForTenant: async (tenantId: string): Promise<AppRegistrationEntry[]> => {
        const byEmployee = new Map<number, AppRegistrationEntry>();

        try {
            const keys = await redisScan(`shadow:t:${tenantId}:app_registration:*`);
            for (const key of keys) {
                try {
                    const raw = await redisGet(key);
                    if (!raw) continue;
                    const entry = JSON.parse(raw) as Partial<AppRegistrationEntry>;
                    if (typeof entry.employeeId !== 'number' || isNaN(entry.employeeId)) continue;
                    byEmployee.set(entry.employeeId, {
                        employeeId: entry.employeeId,
                        registeredAt: entry.registeredAt || entry.lastSeenAt || new Date(0).toISOString(),
                        lastSeenAt: entry.lastSeenAt || entry.registeredAt || new Date(0).toISOString(),
                        source: 'registration',
                    });
                } catch { /* skip malformed */ }
            }
        } catch { /* continue with legacy token fallback */ }

        const devices = await pushStore.listDevicesForTenant(tenantId).catch(() => []);
        for (const device of devices) {
            if (byEmployee.has(device.employeeId)) continue;
            byEmployee.set(device.employeeId, {
                employeeId: device.employeeId,
                registeredAt: device.registered_at,
                lastSeenAt: device.registered_at,
                source: 'push_token',
            });
        }

        return Array.from(byEmployee.values()).sort((a, b) => a.employeeId - b.employeeId);
    },
};

// ── Push send helper ──────────────────────────────────────────────────────────

interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
}

/**
 * Send an Expo push notification to an employee.
 * Uses the free Expo Push API — no additional service needed.
 * Fails silently (logs error) so it never blocks the main flow.
 */
export async function sendPushNotification(tenantId: string, employeeId: number, payload: PushPayload): Promise<void> {
    const token = await pushStore.getToken(tenantId, employeeId);
    if (!token) return;

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                to: token,
                title: payload.title,
                body: payload.body,
                data: payload.data ?? {},
                sound: 'default',
                priority: 'high',
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Expo Push API error (${response.status}):`, text);
        } else {
            console.log(`[${tenantId}] Push sent to employee ${employeeId}`);
        }
    } catch (e) {
        console.error('Push notification send failed:', e);
    }
}
