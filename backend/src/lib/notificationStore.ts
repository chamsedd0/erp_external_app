import { redisGet, redisSet } from './redis';

// All notifications are stored under a single Redis key as a JSON array.
// This mirrors the previous /tmp file approach and requires no signature changes.
const REDIS_KEY = 'shadow:notifications';

export interface Notification {
    id: string;
    employeeId: number;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string; // ISO string
    targetId?: string;
    targetType?: 'time_off' | 'expense' | 'helpdesk' | 'maintenance' | 'timesheet';
}

async function readAll(): Promise<Notification[]> {
    try {
        const raw = await redisGet(REDIS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as Notification[];
    } catch (e) {
        console.error('notificationStore: failed to read from Redis', e);
        return [];
    }
}

async function writeAll(notifications: Notification[]): Promise<void> {
    try {
        await redisSet(REDIS_KEY, JSON.stringify(notifications));
    } catch (e) {
        console.error('notificationStore: failed to write to Redis', e);
    }
}

export const notificationStore = {
    /** Return all notifications for a specific employee, newest-first. */
    getAll: async (employeeId: number): Promise<Notification[]> => {
        const all = await readAll();
        return all.filter(n => n.employeeId === employeeId);
    },

    /** Append a new notification. Trims the total list to the last 1 000 entries. */
    add: async (notification: Notification): Promise<void> => {
        let all = await readAll();
        all.push(notification);
        if (all.length > 1000) {
            all = all.slice(all.length - 1000);
        }
        await writeAll(all);
    },

    /** Mark a single notification as read by its ID. */
    markRead: async (id: string): Promise<void> => {
        const all = await readAll();
        const updated = all.map(n => (n.id === id ? { ...n, read: true } : n));
        await writeAll(updated);
    },
};
