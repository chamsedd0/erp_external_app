"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// In serverless environments (Vercel), only /tmp is writable.
// We use os.tmpdir() to ensure cross-platform compatibility.
const DATA_DIR = path_1.default.join(os_1.default.tmpdir(), 'shadow_portal_data');
const NOTIFICATIONS_FILE = path_1.default.join(DATA_DIR, 'notifications.json');
// Ensure data directory exists
try {
    if (!fs_1.default.existsSync(DATA_DIR)) {
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    }
}
catch (e) {
    console.error("Failed to create data directory:", e);
}
exports.notificationStore = {
    getAll: (employeeId) => {
        if (!fs_1.default.existsSync(NOTIFICATIONS_FILE))
            return [];
        try {
            const data = fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
            const all = JSON.parse(data);
            return all.filter(n => n.employeeId == employeeId);
        }
        catch (e) {
            console.error("Error reading notifications:", e);
            return [];
        }
    },
    add: (notification) => {
        let all = [];
        try {
            if (fs_1.default.existsSync(NOTIFICATIONS_FILE)) {
                all = JSON.parse(fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            }
        }
        catch (e) {
            all = [];
        }
        all.push(notification);
        // Keep last 1000 notifications
        if (all.length > 1000) {
            all = all.slice(all.length - 1000);
        }
        try {
            fs_1.default.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(all, null, 2));
        }
        catch (e) {
            console.error("Error writing notifications:", e);
        }
    },
    markRead: (id) => {
        if (!fs_1.default.existsSync(NOTIFICATIONS_FILE))
            return;
        try {
            const all = JSON.parse(fs_1.default.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
            const updated = all.map(n => n.id === id ? { ...n, read: true } : n);
            fs_1.default.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(updated, null, 2));
        }
        catch (e) {
            console.error("Error marking notification read:", e);
        }
    },
    exists: (targetId, type, status) => {
        return false;
    }
};
