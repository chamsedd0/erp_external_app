import fs from 'fs';
import path from 'path';

export interface Notification {
    id: string;
    userId: number;
    title: string;
    message: string;
    type: 'request_approved' | 'request_rejected' | 'system';
    read: boolean;
    timestamp: string; // ISO string
    relatedRequestId?: number;
    relatedRequestType?: 'time_off' | 'expense';
}

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, 'notifications.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure file exists
if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify([]));
}

export const notificationStore = {
    getAll: () => {
        try {
            const data = fs.readFileSync(FILE_PATH, 'utf-8');
            return JSON.parse(data) as Notification[];
        } catch (error) {
            return [];
        }
    },

    getUserNotifications: (userId: number) => {
        const all = notificationStore.getAll();
        return all.filter(n => n.userId === userId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    add: (notification: Notification) => {
        const all = notificationStore.getAll();
        all.push(notification);
        fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2));
    },

    markRead: (id: string) => {
        const all = notificationStore.getAll();
        const index = all.findIndex(n => n.id === id);
        if (index !== -1) {
            all[index].read = true;
            fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2));
            return true;
        }
        return false;
    }
};
