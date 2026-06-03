import { randomUUID } from 'crypto';
import { redisDel, redisGet, redisLPush, redisLRange, redisSet, redisTrim } from './redis';

const REDIS_KEY = (tenantId: string) => `shadow:t:${tenantId}:notifications`;
const REDIS_LIST_KEY = (tenantId: string) => `shadow:t:${tenantId}:notifications:list`;

export interface Notification {
    id: string;
    employeeId: number;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string; // ISO string
    targetId?: string;
    targetType?: 'timeoff' | 'expense' | 'helpdesk' | 'maintenance' | 'timesheet' | 'attendance';
}

async function readAll(tenantId: string): Promise<Notification[]> {
    try {
        const list = await Promise.resolve(redisLRange(REDIS_LIST_KEY(tenantId), 0, -1)).catch(() => []);
        if (Array.isArray(list) && list.length > 0) {
            return list
                .map(item => {
                    try {
                        return JSON.parse(item) as Notification;
                    } catch {
                        return null;
                    }
                })
                .filter((item): item is Notification => item !== null);
        }

        const raw = await redisGet(REDIS_KEY(tenantId));
        if (!raw) return [];
        return JSON.parse(raw) as Notification[];
    } catch (e) {
        console.error('notificationStore: failed to read from Redis', e);
        return [];
    }
}

async function writeAll(tenantId: string, notifications: Notification[]): Promise<void> {
    try {
        const listKey = REDIS_LIST_KEY(tenantId);
        await Promise.resolve(redisDel(listKey)).catch(() => undefined);
        if (notifications.length > 0) {
            await Promise.resolve(redisLPush(listKey, ...[...notifications].reverse().map(n => JSON.stringify(n)))).catch(() => undefined);
            await Promise.resolve(redisTrim(listKey, 0, 999)).catch(() => undefined);
        }
        await redisSet(REDIS_KEY(tenantId), JSON.stringify(notifications));
    } catch (e) {
        console.error('notificationStore: failed to write to Redis', e);
    }
}

export const notificationStore = {
    /** Return all notifications for a specific employee. */
    getAll: async (tenantId: string, employeeId: number): Promise<Notification[]> => {
        const all = await readAll(tenantId);
        return all.filter(n => n.employeeId === employeeId);
    },

    /** Append a new notification. Trims the total list to the last 1 000 entries. */
    add: async (tenantId: string, notification: Notification): Promise<void> => {
        const safeNotification = {
            ...notification,
            id: notification.id || randomUUID(),
        };
        try {
            const existing = await readAll(tenantId);
            await Promise.resolve(redisLPush(REDIS_LIST_KEY(tenantId), JSON.stringify(safeNotification))).catch(() => undefined);
            await Promise.resolve(redisTrim(REDIS_LIST_KEY(tenantId), 0, 999)).catch(() => undefined);
            await redisSet(REDIS_KEY(tenantId), JSON.stringify([...existing, safeNotification].slice(-1000)));
        } catch (e) {
            console.error('notificationStore: failed to append to Redis list', e);
            const all = await readAll(tenantId);
            await redisSet(REDIS_KEY(tenantId), JSON.stringify([...all, safeNotification].slice(-1000)));
        }
    },

    /** Mark a single notification as read by its ID. */
    markRead: async (tenantId: string, id: string): Promise<void> => {
        const all = await readAll(tenantId);
        await writeAll(tenantId, all.map(n => (n.id === id ? { ...n, read: true } : n)));
    },

    /** Mark all notifications for a given employee as read. */
    markAllRead: async (tenantId: string, employeeId: number): Promise<void> => {
        const all = await readAll(tenantId);
        await writeAll(tenantId, all.map(n => n.employeeId === employeeId ? { ...n, read: true } : n));
    },

    /**
     * List all notifications for a tenant (admin view).
     * Returns newest-first, supports pagination.
     */
    listAllForTenant: async (
        tenantId: string,
        limit = 50,
        offset = 0
    ): Promise<{ total: number; items: Notification[] }> => {
        const all = await readAll(tenantId);
        const sorted = [...all].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return {
            total: sorted.length,
            items: sorted.slice(offset, offset + limit),
        };
    },
};
