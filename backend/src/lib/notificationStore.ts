import fs from 'fs';
import path from 'path';
import os from 'os';

// In serverless environments (Vercel), only /tmp is writable.
// We use os.tmpdir() to ensure cross-platform compatibility.
const DATA_DIR = path.join(os.tmpdir(), 'shadow_portal_data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Ensure data directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.error("Failed to create data directory:", e);
}

export interface Notification {
    id: string;
    employeeId: number;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string; // ISO string
    targetId?: string; // ID of the request (time_off or expense)
    targetType?: 'time_off' | 'expense';
}

export const notificationStore = {
    getAll: (employeeId: number): Notification[] => {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) return [];
        try {
            const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
            const all: Notification[] = JSON.parse(data);
            return all.filter(n => n.employeeId == employeeId);
        } catch (e) {
            console.error("Error reading notifications:", e);
            return [];
        }
    },

    add: (notification: Notification) => {
        let all: Notification[] = [];
        try {
            if (fs.existsSync(NOTIFICATIONS_FILE)) {
                all = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            }
        } catch (e) {
            all = [];
        }
        all.push(notification);
        // Keep last 1000 notifications
        if (all.length > 1000) {
            all = all.slice(all.length - 1000);
        }
        try {
            fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(all, null, 2));
        } catch (e) {
            console.error("Error writing notifications:", e);
        }
    },

    markRead: (id: string) => {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) return;
        try {
            const all: Notification[] = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            const updated = all.map(n => n.id === id ? { ...n, read: true } : n);
            fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2));
        } catch (e) {
            console.error("Error marking notification read:", e);
        }
    },

    exists: (targetId: string, type: string, status: string): boolean => {
        return false;
    }
};
