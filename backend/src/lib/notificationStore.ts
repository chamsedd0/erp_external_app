import fs from 'fs';
import path from 'path';

// Store notifications in a local JSON file for simplicity
const DATA_DIR = path.join(__dirname, '../../data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
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
        if (fs.existsSync(NOTIFICATIONS_FILE)) {
            try {
                all = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            } catch (e) {
                all = [];
            }
        }
        all.push(notification);
        // Keep last 1000 notifications to prevent infinite growth
        if (all.length > 1000) {
            all = all.slice(all.length - 1000);
        }
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(all, null, 2));
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

    // Check if a specific notification already exists to avoid duplicates
    exists: (targetId: string, type: string, status: string): boolean => {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) return false;
        try {
            const all: Notification[] = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            // We consider it a duplicate if we already notified about this specific state for this request
            // But actually, we construct the ID or checking logic in the monitor. 
            // Ideally we just check if we have a notification for this request ID with this message type recently?
            // For simplicity, let the monitor handle duplicate logic by diffing state.
            return false;
        } catch { return false; }
    }
};
