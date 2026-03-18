import { redisGet, redisSet, redisDel } from './redis';

const tokenKey = (tenantId: string, employeeId: number) => `shadow:t:${tenantId}:push_token:${employeeId}`;

interface PushTokenEntry {
    employeeId: number;
    token: string;
    updatedAt: string;
}

// ── Public store API ──────────────────────────────────────────────────────────

export const pushStore = {
    /** Save or update the Expo push token for an employee. */
    saveToken: async (tenantId: string, employeeId: number, token: string): Promise<void> => {
        const entry: PushTokenEntry = { employeeId, token, updatedAt: new Date().toISOString() };
        await redisSet(tokenKey(tenantId, employeeId), JSON.stringify(entry));
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

    /** Remove the push token for an employee (called on logout). */
    removeToken: async (tenantId: string, employeeId: number): Promise<void> => {
        await redisDel(tokenKey(tenantId, employeeId));
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
