import { redisGet, redisSet } from './redis';

const REDIS_KEY = (tenantId: string) => `shadow:t:${tenantId}:notifications`;

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
        let all = await readAll(tenantId);
        all.push(notification);
        if (all.length > 1000) all = all.slice(all.length - 1000);
        await writeAll(tenantId, all);
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
};
