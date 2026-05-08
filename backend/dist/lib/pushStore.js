"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushStore = void 0;
exports.sendPushNotification = sendPushNotification;
const redis_1 = require("./redis");
const tokenKey = (tenantId, employeeId) => `shadow:t:${tenantId}:push_token:${employeeId}`;
// ── Public store API ──────────────────────────────────────────────────────────
exports.pushStore = {
    /** Save or update the Expo push token for an employee. */
    saveToken: async (tenantId, employeeId, token) => {
        const entry = { employeeId, token, updatedAt: new Date().toISOString() };
        await (0, redis_1.redisSet)(tokenKey(tenantId, employeeId), JSON.stringify(entry));
    },
    /** Get the Expo push token for an employee. Returns null if not registered. */
    getToken: async (tenantId, employeeId) => {
        try {
            const raw = await (0, redis_1.redisGet)(tokenKey(tenantId, employeeId));
            if (!raw)
                return null;
            const entry = JSON.parse(raw);
            return entry.token;
        }
        catch {
            return null;
        }
    },
    /** Remove the push token for an employee (called on logout). */
    removeToken: async (tenantId, employeeId) => {
        await (0, redis_1.redisDel)(tokenKey(tenantId, employeeId));
    },
    /**
     * List every registered push token across all tenants.
     * Returns an array of { tenantId, employeeId } pairs.
     * Used by the cron job to know who to check.
     */
    listAllTokens: async () => {
        try {
            const keys = await (0, redis_1.redisScan)('shadow:t:*:push_token:*');
            return keys.map(key => {
                // key format: shadow:t:<tenantId>:push_token:<employeeId>
                const parts = key.split(':');
                const tenantId = parts[2];
                const employeeId = parseInt(parts[4], 10);
                return { tenantId, employeeId };
            }).filter(e => !isNaN(e.employeeId));
        }
        catch {
            return [];
        }
    },
    /**
     * List all registered devices for a specific tenant.
     * Returns partial token previews (first 12 chars + "…") for display.
     */
    listDevicesForTenant: async (tenantId) => {
        try {
            const keys = await (0, redis_1.redisScan)(`shadow:t:${tenantId}:push_token:*`);
            const results = [];
            for (const key of keys) {
                try {
                    const raw = await (0, redis_1.redisGet)(key);
                    if (!raw)
                        continue;
                    const entry = JSON.parse(raw);
                    results.push({
                        employeeId: entry.employeeId,
                        token_preview: entry.token.slice(0, 20) + '…',
                        registered_at: entry.updatedAt,
                    });
                }
                catch { /* skip malformed */ }
            }
            return results.sort((a, b) => a.employeeId - b.employeeId);
        }
        catch {
            return [];
        }
    },
};
/**
 * Send an Expo push notification to an employee.
 * Uses the free Expo Push API — no additional service needed.
 * Fails silently (logs error) so it never blocks the main flow.
 */
async function sendPushNotification(tenantId, employeeId, payload) {
    const token = await exports.pushStore.getToken(tenantId, employeeId);
    if (!token)
        return;
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
        }
        else {
            console.log(`[${tenantId}] Push sent to employee ${employeeId}`);
        }
    }
    catch (e) {
        console.error('Push notification send failed:', e);
    }
}
